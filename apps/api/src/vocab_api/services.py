from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from vocab_estimator import VocabularyResponse, estimate_vocabulary, load_word_ranks
from vocab_estimator.models import EstimateResult, WordRank

from .config import get_settings


@lru_cache
def load_default_word_ranks() -> dict[str, WordRank]:
    path = Path(get_settings().word_rank_path)
    return load_word_ranks(path)


def estimate_from_inputs(responses: list[tuple[str, bool]]) -> EstimateResult:
    normalized = [VocabularyResponse(word, known) for word, known in responses]
    return estimate_vocabulary(load_default_word_ranks(), normalized)

