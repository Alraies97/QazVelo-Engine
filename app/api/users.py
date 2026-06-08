from fastapi import APIRouter, status, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas.users import UserResponse, UserUpdate, ChangePasswordRequest
from app.core.security import verify_password, hash_password
import jwt
from app.core.security import SECRET_KEY, ALGORITHM
from app.api.auth import USERS_DB

router = APIRouter(prefix="/users", tags=["Users"])
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        decoded = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if decoded.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        username = decoded.get("sub")
        user_id = decoded.get("user_id")
        if not username or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

        user = USERS_DB.get(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "is_active": current_user["is_active"],
    }


@router.put("/update", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_user_profile(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]

    if payload.username:
        for u in USERS_DB.values():
            if u["id"] != user_id and u["username"] == payload.username:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        USERS_DB[user_id]["username"] = payload.username

    if payload.email:
        for u in USERS_DB.values():
            if u["id"] != user_id and u["email"] == payload.email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        USERS_DB[user_id]["email"] = payload.email

    updated_user = USERS_DB[user_id]
    return {
        "id": updated_user["id"],
        "username": updated_user["username"],
        "email": updated_user["email"],
        "is_active": updated_user["is_active"],
    }


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    user = USERS_DB[user_id]

    if not verify_password(payload.old_password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect old password")

    new_password_bytes = payload.new_password.encode("utf-8")
    if len(new_password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password exceeds 72-byte limit for bcrypt"
        )

    new_hashed = hash_password(payload.new_password)
    USERS_DB[user_id]["hashed_password"] = new_hashed

    return {"message": "Password updated successfully"}
