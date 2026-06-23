from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


AdaptiveStatus = Literal["known", "unknown", "uncertain"]


@dataclass(frozen=True)
class WordRank:
    word: str
    rank: int
    frequency: float
    source: str


@dataclass(frozen=True)
class TestWord:
    word: str
    rank: int
    stage: int


@dataclass(frozen=True)
class VocabularyResponse:
    word: str
    known: bool


@dataclass(frozen=True)
class AdaptiveResponse:
    word: str
    status: AdaptiveStatus


@dataclass(frozen=True)
class AdaptiveState:
    current_word: TestWord | None
    completed: bool
    estimate: "EstimateResult | None"
    progress: float
    answered_count: int
    max_items: int
    target_rank: int


@dataclass(frozen=True)
class EstimateResult:
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    sample_size: int
    ignored_words: list[str]
