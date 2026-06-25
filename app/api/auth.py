from fastapi import APIRouter, status, HTTPException, Request, Depends
from app.schemas.users import UserLogin, TokenResponse, UserCreate, UserResponse, RefreshRequest
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from fastapi_limiter.depends import RateLimiter
import jwt
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/auth", tags=["Authentication"])

USERS_DB = {}
USER_ID_COUNTER = 1


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(user_in: UserCreate):
    global USER_ID_COUNTER

    if user_in.username in USERS_DB:
        raise HTTPException(status_code=400,detail="username already registered")

    for u in USERS_DB.values():
        if u["email"]==user_in.email or u["email"]==user_in.email:
            raise HTTPException(status_code=400,detail="username or email already registered")


    hashed = hash_password(user_in.password)
    new_user={
        "id":USER_ID_COUNTER,
        "username":user_in.username,
        "email":user_in.email,
        "hashed_password":hashed,
        "is_active":True,
    }

    USERS_DB[user_in.username]=new_user
    USER_ID_COUNTER+=1

    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=5, seconds=60))]
)
async def login(request: Request, credentials: UserLogin):

        user = USERS_DB.get(credentials.username)


        dummy_hash = "$2b$12$K3v9gD0mK3v9gD0mK3v9gOuxVbC67x8OWhmCg8G2O8O8O8O8O8O8O"
        target_hash = user["hashed_password"] if user else dummy_hash
        
        password_correct = verify_password(credentials.password, target_hash)

        
        if not user or not password_correct:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Incorrect username or password")

        access_token = create_access_token(data={"sub": user["username"], "user_id": user["id"]})
        refresh_token = create_refresh_token(data={"sub": user["username"], "user_id": user["id"]})
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(RateLimiter(times=5, seconds=60))]
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

