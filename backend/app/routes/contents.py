"""Content CRUD routes — each user manages their own library."""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.content import ContentCreate, ContentResponse, ContentUpdate

router = APIRouter(prefix="/api/content", tags=["content"])


def _doc_to_response(doc: dict) -> ContentResponse:
    return ContentResponse(
        id=str(doc["_id"]),
        title=doc["title"],
        type=doc["type"],
        source=doc["source"],
        created_at=doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
        user_id=str(doc["user_id"]),
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ContentResponse)
async def create_content(
    body: ContentCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "user_id": current_user["_id"],
        "title": body.title.strip(),
        "type": body.type.value,
        "source": body.source.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db["contents"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_response(doc)


@router.get("", response_model=list[ContentResponse])
async def list_content(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db["contents"].find({"user_id": current_user["_id"]}).sort("created_at", -1)
    docs = await cursor.to_list(length=500)
    return [_doc_to_response(d) for d in docs]


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(
    content_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(content_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    doc = await db["contents"].find_one({"_id": oid, "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _doc_to_response(doc)


@router.patch("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: str,
    body: ContentUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(content_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    doc = await db["contents"].find_one({"_id": oid, "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    updates = {}
    if body.title is not None:
        updates["title"] = body.title.strip()
    if body.source is not None:
        updates["source"] = body.source.strip()
    if updates:
        await db["contents"].update_one({"_id": oid}, {"$set": updates})
        doc.update(updates)
    return _doc_to_response(doc)


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(
    content_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        oid = ObjectId(content_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    result = await db["contents"].delete_one({"_id": oid, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None
