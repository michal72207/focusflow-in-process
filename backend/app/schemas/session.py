"""Session request/response schemas."""
from pydantic import BaseModel, field_validator
from typing import Optional, List


class SessionCreate(BaseModel):
    content_id: str


class ReadingCreate(BaseModel):
    position: float
    score: float

    @field_validator("score")
    @classmethod
    def score_range(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("Score must be between 0 and 1")
        return v

    @field_validator("position")
    @classmethod
    def position_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Position must be non-negative")
        return v


class ReadingResponse(BaseModel):
    position: float
    score: float
    created_at: str


class SessionResponse(BaseModel):
    id: str
    content_id: str
    started_at: str
    ended_at: Optional[str] = None
    reading_count: int = 0
    average_score: Optional[float] = None


class SessionDetailResponse(SessionResponse):
    readings: List[ReadingResponse] = []
