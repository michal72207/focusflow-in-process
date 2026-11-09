"""User profile routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..utils.security import hash_password, verify_password
from ..dependencies import get_current_user
from ..schemas.auth import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdateDisplayName(BaseModel):
    display_name: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


def _user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        display_name=user["display_name"],
        created_at=user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user["created_at"],
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return _user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateDisplayName,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    name = body.display_name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Display name cannot be empty")
    await db["users"].update_one({"_id": current_user["_id"]}, {"$set": {"display_name": name}})
    current_user["display_name"] = name
    return _user_to_response(current_user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePassword,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not verify_password(body.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")
    new_hash = hash_password(body.new_password)
    await db["users"].update_one({"_id": current_user["_id"]}, {"$set": {"password_hash": new_hash}})
    return None


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    uid = current_user["_id"]
    await db["contents"].delete_many({"user_id": uid})
    await db["sessions"].delete_many({"user_id": uid})
    await db["users"].delete_one({"_id": uid})
    return None
