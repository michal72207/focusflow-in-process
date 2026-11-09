"""Session lifecycle routes: start, record readings, end, list, get."""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.session import (
    SessionCreate,
    ReadingCreate,
    ReadingResponse,
    SessionResponse,
    SessionDetailResponse,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _session_to_response(doc: dict, include_readings: bool = False):
    readings = doc.get("readings", [])
    scores = [r["score"] for r in readings if "score" in r]
    avg = round(sum(scores) / len(scores), 4) if scores else None
    ended_at = doc.get("ended_at")

    base = dict(
        id=str(doc["_id"]),
        content_id=str(doc["content_id"]),
        started_at=doc["started_at"].isoformat() if isinstance(doc["started_at"], datetime) else doc["started_at"],
        ended_at=ended_at.isoformat() if isinstance(ended_at, datetime) else ended_at,
        reading_count=len(readings),
        average_score=avg,
    )
    if include_readings:
        reading_list = []
        for r in readings:
            ts = r.get("created_at")
            reading_list.append(
                ReadingResponse(
                    position=r["position"],
                    score=r["score"],
                    created_at=ts.isoformat() if isinstance(ts, datetime) else (ts or ""),
                )
            )
        return SessionDetailResponse(**base, readings=reading_list)
    return SessionResponse(**base)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SessionResponse)
async def start_session(
    body: SessionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        content_oid = ObjectId(body.content_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid content_id")

    content = await db["contents"].find_one({"_id": content_oid, "user_id": current_user["_id"]})
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": current_user["_id"],
        "content_id": content_oid,
        "started_at": now,
        "ended_at": None,
        "readings": [],
    }
    result = await db["sessions"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _session_to_response(doc)


@router.post("/{session_id}/readings", status_code=status.HTTP_201_CREATED, response_model=ReadingResponse)
async def add_reading(
    session_id: str,
    body: ReadingCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        sid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    session = await db["sessions"].find_one({"_id": sid, "user_id": current_user["_id"]})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.get("ended_at") is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session already ended")

    now = datetime.now(timezone.utc)
    reading = {"position": body.position, "score": body.score, "created_at": now}
    await db["sessions"].update_one({"_id": sid}, {"$push": {"readings": reading}})
    return ReadingResponse(position=body.position, score=body.score, created_at=now.isoformat())


@router.post("/{session_id}/end", response_model=SessionDetailResponse)
async def end_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        sid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    session = await db["sessions"].find_one({"_id": sid, "user_id": current_user["_id"]})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = datetime.now(timezone.utc)
    await db["sessions"].update_one({"_id": sid}, {"$set": {"ended_at": now}})
    session["ended_at"] = now
    return _session_to_response(session, include_readings=True)


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db["sessions"].find({"user_id": current_user["_id"]}).sort("started_at", -1)
    docs = await cursor.to_list(length=200)
    return [_session_to_response(d) for d in docs]


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        sid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    doc = await db["sessions"].find_one({"_id": sid, "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _session_to_response(doc, include_readings=True)
