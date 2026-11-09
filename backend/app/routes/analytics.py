"""Personal analytics routes."""
from fastapi import APIRouter, Depends
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/personal")
async def personal_analytics(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    uid = current_user["_id"]

    cursor = db["sessions"].find({"user_id": uid, "ended_at": {"$ne": None}}).sort("started_at", -1)
    sessions = await cursor.to_list(length=500)

    total_sessions = len(sessions)
    total_readings = sum(len(s.get("readings", [])) for s in sessions)
    all_scores = [r["score"] for s in sessions for r in s.get("readings", []) if "score" in r]
    overall_avg = round(sum(all_scores) / len(all_scores), 4) if all_scores else None

    timeline = []
    for s in sessions:
        readings = s.get("readings", [])
        scores = [r["score"] for r in readings if "score" in r]
        avg = round(sum(scores) / len(scores), 4) if scores else None
        started = s["started_at"]
        timeline.append({
            "session_id": str(s["_id"]),
            "content_id": str(s["content_id"]),
            "started_at": started.isoformat() if isinstance(started, datetime) else started,
            "average_score": avg,
            "reading_count": len(readings),
        })

    return {
        "total_sessions": total_sessions,
        "total_readings": total_readings,
        "overall_average_score": overall_avg,
        "sessions_timeline": timeline[:50],
    }
