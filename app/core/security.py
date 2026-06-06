from datetime import datetime, timedelta, timezone
import jwt
import bcrypt


SECRET_KEY = "SUPER_SECRET_FOR_NOW"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]
    
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes,salt)

    return hashed.decode("utf-8")   

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        plain_password_bytes = plain_password.encode("utf-8")
        hashed_password_bytes = hashed_password.encode("utf-8")

        return bcrypt.checkpw(plain_password_bytes, hashed_password_bytes)
    except:
        return False
    

def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt