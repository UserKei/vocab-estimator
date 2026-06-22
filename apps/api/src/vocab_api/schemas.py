from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class EstimateResponseInput(BaseModel):
    word: str
    known: bool


class EstimateRequest(BaseModel):
    responses: list[EstimateResponseInput] = Field(min_length=1)


class EstimateResultOut(BaseModel):
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    sample_size: int
    ignored_words: list[str]


class StudentResultCreate(BaseModel):
    student_code: str = Field(min_length=1)
    cet4_score: int | None = None
    cet6_score: int | None = None
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    responses: list[EstimateResponseInput] = Field(default_factory=list)


class StudentResultOut(BaseModel):
    id: int
    student_code: str
    cet4_score: int | None
    cet6_score: int | None
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    created_at: datetime


class HealthOut(BaseModel):
    status: str

