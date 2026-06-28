from __future__ import annotations

from typing import ClassVar
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class StudentResult(SQLModel, table=True):
    __tablename__: ClassVar[str] = "student_results"

    id: int | None = Field(default=None, primary_key=True)
    student_code: str = Field(index=True)
    student_name: str
    cet4_score: int | None = None
    cet6_score: int | None = None
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EstimateResponse(SQLModel, table=True):
    __tablename__: ClassVar[str] = "estimate_responses"

    id: int | None = Field(default=None, primary_key=True)
    student_result_id: int = Field(index=True, foreign_key="student_results.id")
    word: str
    known: bool
    rank: int | None = None


class BatchJob(SQLModel, table=True):
    __tablename__: ClassVar[str] = "batch_jobs"

    id: int | None = Field(default=None, primary_key=True)
    filename: str
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    row_count: int
    ignored_count: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
