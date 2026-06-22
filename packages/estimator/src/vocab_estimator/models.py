from __future__ import annotations

from dataclasses import dataclass


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
class EstimateResult:
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    sample_size: int
    ignored_words: list[str]
