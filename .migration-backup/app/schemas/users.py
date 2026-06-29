from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    username: str = Field(...,min_length=4,max_length=50)
    email: EmailStr = Field(...,min_length=3,max_length=50)
    password: str = Field(...,min_length=8,max_length=50)


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool=True


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=4, max_length=50)
    email: EmailStr | None = Field(None, min_length=3, max_length=50)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8, max_length=72)




