from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from vocab_estimator import (
    VocabularyResponse,
    estimate_vocabulary,
    generate_first_stage_words,
    generate_second_stage_words,
    load_word_ranks,
    parse_response_csv_text,
)
from vocab_estimator.models import EstimateResult, TestWord, WordRank

from .config import get_settings


@lru_cache
def load_default_word_ranks() -> dict[str, WordRank]:
    path = Path(get_settings().word_rank_path)
    return load_word_ranks(path)


def estimate_from_inputs(responses: list[tuple[str, bool]]) -> EstimateResult:
    normalized = [VocabularyResponse(word, known) for word, known in responses]
    return estimate_vocabulary(load_default_word_ranks(), normalized)


def generate_first_stage(seed: int | None, count: int) -> list[TestWord]:
    return generate_first_stage_words(load_default_word_ranks(), count=count, seed=seed)


def generate_next_stage(responses: list[tuple[str, bool]], seed: int | None, count: int) -> list[TestWord]:
    normalized = [VocabularyResponse(word, known) for word, known in responses]
    return generate_second_stage_words(load_default_word_ranks(), normalized, count=count, seed=seed)


def estimate_from_csv_text(content: str) -> tuple[EstimateResult, int]:
    responses = parse_response_csv_text(content)
    result = estimate_vocabulary(load_default_word_ranks(), responses)
    return result, len(responses)
