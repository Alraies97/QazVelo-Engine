from fastapi import APIRouter, status, HTTPException
from app.schemas.users import UserLogin, TokenResponse, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

USERS_DB = {}
USER_ID_COUNTER = 1


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(user_in: UserCreate):
    global USER_ID_COUNTER

    for u in USERS_DB.values():
        if u["username"]==user_in.username or u["email"]==user_in.email:
            raise HTTPException(status_code=400,detail="username or email already registered")
    

    hashed = hash_password(user_in.password)
    new_user={
        "id":USER_ID_COUNTER,
        "username":user_in.username,
        "email":user_in.email,
        "password":hashed,
        "is_active":True,
    }

    USERS_DB[USER_ID_COUNTER]=new_user
    USER_ID_COUNTER+=1

    return new_user


@router.post("login",response_model=TokenResponse,status_code=status.HTTP_200_OK)
async def login(credentials: UserLogin):

    user = None
    for u in USERS_DB.values():
        if u["username"] == credentials.username:
            user=u
            break
    
    if not user or not verify_password(credentials.password,user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Incorrect username or password")


    access_token=create_token(data={"sub":user["username"],"user_id":user["id"]})
    return {"access_token":access_token,"token_type":"bearer"}

