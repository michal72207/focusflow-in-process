"""Authentication routes: register, login, logout, me."""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..utils.security import hash_password, verify_password, create_access_token
from ..schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        display_name=user["display_name"],
        created_at=user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user["created_at"],
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register(body: RegisterRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    email_lower = body.email.lower()
    existing = await db["users"].find_one({"email": email_lower})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    now = datetime.now(timezone.utc)
    user_doc = {
        "email": email_lower,
        "password_hash": hash_password(body.password),
        "display_name": body.display_name.strip(),
        "created_at": now,
    }
    result = await db["users"].insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return _user_to_response(user_doc)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    email_lower = body.email.lower()
    user = await db["users"].find_one({"email": email_lower})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    token, expires_in = create_access_token({"sub": str(user["_id"])})
    return TokenResponse(access_token=token, token_type="bearer", expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: dict = Depends(get_current_user)):
    # Stateless JWT — token invalidation happens client-side
    return None


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return _user_to_response(current_user)
