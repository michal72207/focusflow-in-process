"""Content request/response schemas."""
from pydantic import BaseModel, field_validator
from typing import Optional
from enum import Enum


class ContentType(str, Enum):
    youtube = "youtube"
    text = "text"
    web = "web"


class ContentCreate(BaseModel):
    title: str
    type: ContentType
    source: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v

    @field_validator("source")
    @classmethod
    def source_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Source cannot be empty")
        return v


class ContentResponse(BaseModel):
    id: str
    title: str
    type: str
    source: str
    created_at: str
    user_id: str


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    source: Optional[str] = None
