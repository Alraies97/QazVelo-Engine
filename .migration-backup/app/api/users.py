from fastapi import APIRouter, status, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas.users import UserResponse, UserUpdate, ChangePasswordRequest
from app.core.security import verify_password, hash_password, SECRET_KEY, ALGORITHM
from fastapi_limiter.depends import RateLimiter
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.users import UserModel

router = APIRouter(prefix="/users", tags=["Users"])
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> UserModel:
    try:
        decoded = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if decoded.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
            
        username = decoded.get("sub")
        user_id = decoded.get("user_id")
        if not username or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
            
        result = await db.execute(select(UserModel).where(UserModel.username == username))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
            
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_current_user_profile(current_user: UserModel = Depends(get_current_user)):
    return current_user


@router.put(
    "/update",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=10, seconds=60))]
)
async def update_user_profile(
    request: Request,
    payload: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if payload.username:
        result = await db.execute(
            select(UserModel).where(UserModel.username == payload.username, UserModel.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        current_user.username = payload.username

    if payload.email:
        result = await db.execute(
            select(UserModel).where(UserModel.email == payload.email, UserModel.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        current_user.email = payload.email

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=3, seconds=60))]
)
async def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect old password")

    new_password_bytes = payload.new_password.encode("utf-8")
    if len(new_password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password exceeds 72-byte limit for bcrypt"
        )

    # تشفير وتحديث الباسوورد
    current_user.hashed_password = hash_password(payload.new_password)
    
    await db.commit()
    return {"message": "Password updated successfully"}