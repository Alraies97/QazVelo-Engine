from fastapi import APIRouter, status, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.users import UserModel
from app.schemas.users import UserLogin, TokenResponse, UserCreate, UserResponse, RefreshRequest
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from fastapi_limiter.depends import RateLimiter
import jwt
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).where(UserModel.username == user_in.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")

    result = await db.execute(select(UserModel).where(UserModel.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    new_user = UserModel(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=5, seconds=60))],
)
async def login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserModel).where(UserModel.username == credentials.username))
    user = result.scalar_one_or_none()

    dummy_hash = "$2b$12$K3v9gD0mK3v9gD0mK3v9gOuxVbC67x8OWhmCg8G2O8O8O8O8O8O8O"
    target_hash = user.hashed_password if user else dummy_hash
    password_correct = verify_password(credentials.password, target_hash)

    if not user or not password_correct:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    refresh_token = create_refresh_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=5, seconds=60))],
)
async def refresh_token(request: Request, payload: RefreshRequest):
    try:
        decoded = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        username = decoded.get("sub")
        user_id = decoded.get("user_id")
        if not username or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_access_token = create_access_token(data={"sub": username, "user_id": user_id})
    new_refresh_token = create_refresh_token(data={"sub": username, "user_id": user_id})
    return {"access_token": new_access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}
