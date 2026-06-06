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
    token_type: str="bearer"




