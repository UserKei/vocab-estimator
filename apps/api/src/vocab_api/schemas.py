from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EstimateResponseInput(BaseModel):
    word: str
    known: bool


class AdaptiveResponseInput(BaseModel):
    word: str
    status: Literal["known", "unknown", "uncertain"]


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


class TestSessionRequest(BaseModel):
    seed: int | None = None
    stage1_size: int = Field(default=40, ge=4, le=200)


class TestWordOut(BaseModel):
    word: str
    rank: int
    stage: int


class TestSessionOut(BaseModel):
    session_id: str
    stage: int
    words: list[TestWordOut]


class AdaptiveTestSessionRequest(BaseModel):
    seed: int | None = None
    max_items: int = Field(default=24, ge=1, le=80)
    min_items: int = Field(default=10, ge=1, le=80)
    start_rank: int = Field(default=5000, ge=1)


class AdaptiveAnswerRequest(BaseModel):
    responses: list[AdaptiveResponseInput] = Field(default_factory=list)
    seed: int | None = None
    max_items: int = Field(default=24, ge=1, le=80)
    min_items: int = Field(default=10, ge=1, le=80)
    start_rank: int = Field(default=5000, ge=1)


class AdaptiveSessionOut(BaseModel):
    session_id: str
    current_word: TestWordOut | None
    completed: bool
    estimate: EstimateResultOut | None
    progress: float
    answered_count: int
    max_items: int
    target_rank: int


class NextStageRequest(BaseModel):
    responses: list[EstimateResponseInput] = Field(min_length=1)
    seed: int | None = None
    stage2_size: int = Field(default=110, ge=4, le=240)
    excluded_words: list[str] = Field(default_factory=list)


class FinalEstimateRequest(BaseModel):
    responses: list[EstimateResponseInput] = Field(min_length=1)


class BatchJobOut(BaseModel):
    id: int
    filename: str
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    row_count: int
    ignored_count: int
    created_at: datetime


class StabilityExperimentRequest(BaseModel):
    output_path: str = "reports/outputs/stability.csv"
    evaluation_wordlist_path: str | None = "data/wordlists/evaluation_wordlist.csv"
    unknown_ratios: list[float] = Field(default_factory=lambda: [0.1, 0.2, 0.3])
    sample_lengths: list[int] = Field(default_factory=lambda: [200, 300, 400])
    repeats: int = 100
    bootstrap_iterations: int = 40


class StabilityExperimentOut(BaseModel):
    output_path: str
    rows_written: int


class TextEstimateRequest(BaseModel):
    text_paths: list[str] = Field(min_length=1)
    output_path: str = "reports/outputs/text_estimates.csv"


class TextEstimateRow(BaseModel):
    text_path: str
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    unique_words: int
    matched_words: int
    ignored_words: list[str]


class TextEstimateOut(BaseModel):
    output_path: str
    results: list[TextEstimateRow]


class ReportOutputsOut(BaseModel):
    text_estimates: list[dict[str, str]]
    learner_profiles: list[dict[str, str]]
    stability_summary: list[dict[str, str]]
    student_summary: list[dict[str, str]]
    student_correlation: dict[str, object]


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
