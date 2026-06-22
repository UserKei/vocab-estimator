from __future__ import annotations

import random
from collections.abc import Iterable

from .estimation import estimate_vocabulary
from .models import TestWord, VocabularyResponse, WordRank


def generate_first_stage_words(
    word_ranks: dict[str, WordRank],
    *,
    count: int = 40,
    seed: int | None = None,
) -> list[TestWord]:
    ranks = _sorted_ranks(word_ranks)
    return _banded_sample(ranks, count=count, seed=seed, stage=1)


def generate_second_stage_words(
    word_ranks: dict[str, WordRank],
    responses: Iterable[VocabularyResponse | tuple[str, bool]],
    *,
    count: int = 80,
    seed: int | None = None,
) -> list[TestWord]:
    observed = list(responses)
    result = estimate_vocabulary(word_ranks, observed, bootstrap_iterations=0)
    answered_words = {
        (response.word if isinstance(response, VocabularyResponse) else response[0]).lower()
        for response in observed
    }
    ranks = [
        rank
        for rank in _sorted_ranks(word_ranks)
        if rank.word not in answered_words
    ]
    if not ranks:
        raise ValueError("no words available for second stage")

    lower, upper = _second_stage_window(result.estimate, ranks)
    focused = [rank for rank in ranks if lower <= rank.rank <= upper]
    while len(focused) < min(count, len(ranks)) and (lower > 1 or upper < ranks[-1].rank):
        width = max(100, upper - lower)
        lower = max(1, lower - width)
        upper = min(ranks[-1].rank, upper + width)
        focused = [rank for rank in ranks if lower <= rank.rank <= upper]
    candidates = focused if focused else ranks
    return _banded_sample(candidates, count=count, seed=seed, stage=2)


def _sorted_ranks(word_ranks: dict[str, WordRank]) -> list[WordRank]:
    ranks = sorted(word_ranks.values(), key=lambda item: item.rank)
    if not ranks:
        raise ValueError("word rank table is empty")
    return ranks


def _banded_sample(
    ranks: list[WordRank],
    *,
    count: int,
    seed: int | None,
    stage: int,
) -> list[TestWord]:
    if count <= 0:
        raise ValueError("count must be positive")
    if count >= len(ranks):
        return [TestWord(word=rank.word, rank=rank.rank, stage=stage) for rank in ranks]

    rng = random.Random(seed)
    selected: list[WordRank] = []
    seen_words: set[str] = set()
    for index in range(count):
        start = int(index * len(ranks) / count)
        end = int((index + 1) * len(ranks) / count)
        band = ranks[start:max(start + 1, end)]
        available = [rank for rank in band if rank.word not in seen_words] or band
        chosen = available[rng.randrange(len(available))]
        selected.append(chosen)
        seen_words.add(chosen.word)
    selected.sort(key=lambda item: item.rank)
    return [TestWord(word=rank.word, rank=rank.rank, stage=stage) for rank in selected]


def _second_stage_window(estimate: int, ranks: list[WordRank]) -> tuple[int, int]:
    max_rank = ranks[-1].rank
    center = max(1, min(max_rank, estimate))
    width = max(500, round(center * 0.45))
    return max(1, center - width), min(max_rank, center + width)
