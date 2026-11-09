"""Question generation and answering routes using Google Gemini."""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from ..database import get_db
from ..dependencies import get_current_user
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/questions", tags=["questions"])


class AnswerRequest(BaseModel):
    question_id: str
    answer: str


def _format_questions(docs: list) -> list:
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "question_text": d["question_text"],
            "options": d["options"],
            "correct_answer": d["correct_answer"],
            "explanation": d.get("explanation", ""),
        })
    return result


async def _generate_with_gemini(content_doc: dict) -> list:
    """Call Gemini API to generate questions for the content."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return []

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)

        content_desc = content_doc.get("title", "educational content")
        source_text = content_doc.get("source", "")
        content_type = content_doc.get("type", "text")

        prompt = f"""You are an educational assistant. Generate 5 multiple-choice comprehension questions
for the following {content_type} content titled: "{content_desc}"

Content source/description: {source_text[:500]}

Return ONLY valid JSON in this exact format, no extra text:
{{
  "questions": [
    {{
      "question_text": "Question here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation why this is correct"
    }}
  ]
}}"""

        response = model.generate_content(prompt)
        text = response.text.strip()

        import json
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        data = json.loads(text)
        questions = data.get("questions", [])

        valid = []
        for q in questions:
            if (
                isinstance(q.get("question_text"), str)
                and isinstance(q.get("options"), list)
                and len(q["options"]) == 4
                and isinstance(q.get("correct_answer"), str)
                and q["correct_answer"] in q["options"]
            ):
                valid.append(q)
        return valid

    except Exception as e:
        logger.warning(f"Gemini question generation failed: {e}")
        return []


@router.get("/{content_id}")
async def get_questions(
    content_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        cid = ObjectId(content_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    content = await db["contents"].find_one({"_id": cid, "user_id": current_user["_id"]})
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    cursor = db["questions"].find({"content_id": cid})
    docs = await cursor.to_list(length=20)
    return {"questions": _format_questions(docs), "cached": len(docs) > 0}


@router.post("/{content_id}/generate")
async def generate_questions(
    content_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        cid = ObjectId(content_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    content = await db["contents"].find_one({"_id": cid, "user_id": current_user["_id"]})
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")

    settings = get_settings()
    if not settings.gemini_api_key:
        return {
            "questions": [],
            "message": "Gemini API key not configured. Add GEMINI_API_KEY to .env to enable question generation.",
        }

    questions = await _generate_with_gemini(content)
    if not questions:
        return {"questions": [], "message": "Could not generate questions at this time."}

    await db["questions"].delete_many({"content_id": cid})
    now = datetime.now(timezone.utc)
    docs = [
        {
            "content_id": cid,
            "question_text": q["question_text"],
            "options": q["options"],
            "correct_answer": q["correct_answer"],
            "explanation": q.get("explanation", ""),
            "created_at": now,
        }
        for q in questions
    ]
    result = await db["questions"].insert_many(docs)
    for doc, oid in zip(docs, result.inserted_ids):
        doc["_id"] = oid

    return {"questions": _format_questions(docs), "message": f"Generated {len(docs)} questions"}


@router.post("/{question_id}/answer")
async def answer_question(
    question_id: str,
    body: AnswerRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        qid = ObjectId(question_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    question = await db["questions"].find_one({"_id": qid})
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    is_correct = body.answer == question["correct_answer"]
    return {
        "correct": is_correct,
        "correct_answer": question["correct_answer"],
        "explanation": question.get("explanation", ""),
    }
