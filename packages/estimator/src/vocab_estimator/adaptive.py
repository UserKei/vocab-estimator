from __future__ import annotations

import random
from collections.abc import Iterable, Sequence
from statistics import median
from typing import cast

from .estimation import estimate_vocabulary
from .models import (
    AdaptiveResponse,
    AdaptiveState,
    AdaptiveStatus,
    EstimateResult,
    TestWord,
    VocabularyResponse,
    WordRank,
)
from .text import normalize_word

ADAPTIVE_METHOD = "adaptive_rank_cutoff_v1"
ADAPTIVE_STATUSES: set[str] = {"known", "unknown", "uncertain"}


def generate_adaptive_state(
    word_ranks: dict[str, WordRank],
    responses: Iterable[AdaptiveResponse | tuple[str, str]],
    *,
    seed: int | None = None,
    max_items: int = 24,
    min_items: int = 10,
    start_rank: int = 5000,
) -> AdaptiveState:
    if max_items <= 0:
        raise ValueError("max_items must be positive")
    if min_items <= 0:
        raise ValueError("min_items must be positive")
    min_items = min(min_items, max_items)

    ranks = _sorted_ranks(word_ranks)
    normalized, _ = _normalize_responses(word_ranks, responses)
    target_rank = _next_target_rank(ranks, normalized, start_rank)
    estimate = estimate_adaptive_vocabulary(word_ranks, normalized) if normalized else None
    completed = _should_stop(normalized, estimate, min_items, max_items)
    current_word = None if completed else _pick_word(ranks, normalized, target_rank, seed)

    return AdaptiveState(
        current_word=current_word,
        completed=completed,
        estimate=estimate if completed else None,
        progress=round(min(100.0, (len(normalized) / max_items) * 100), 1),
        answered_count=len(normalized),
        max_items=max_items,
        target_rank=target_rank,
    )


def estimate_adaptive_vocabulary(
    word_ranks: dict[str, WordRank],
    responses: Iterable[AdaptiveResponse | tuple[str, str]],
) -> EstimateResult:
    normalized, ignored_words = _normalize_responses(word_ranks, responses)
    if not normalized:
        raise ValueError("at least one adaptive response must match the word rank table")

    binary_responses = [
        VocabularyResponse(response.word, response.status == "known")
        for response in normalized
        if response.status != "uncertain"
    ]
    uncertain_count = len(normalized) - len(binary_responses)
    if binary_responses:
        estimate = estimate_vocabulary(word_ranks, binary_responses, bootstrap_iterations=0).estimate
    else:
        estimate = int(median(word_ranks[response.word].rank for response in normalized))

    valid_ranks = [word_ranks[response.word].rank for response in normalized]
    known_ranks = [
        word_ranks[response.word].rank
        for response in normalized
        if response.status == "known"
    ]
    unknown_ranks = [
        word_ranks[response.word].rank
        for response in normalized
        if response.status == "unknown"
    ]
    range_low, range_high = _estimate_range(
        estimate,
        known_ranks,
        unknown_ranks,
        valid_ranks,
        uncertain_count,
    )

    binary_count = len(binary_responses)
    confidence = min(0.9, 0.25 + min(0.55, binary_count * 0.055))
    confidence *= max(0.35, 1 - 0.35 * uncertain_count / len(normalized))
    return EstimateResult(
        estimate=max(0, int(estimate)),
        range_low=range_low,
        range_high=range_high,
        confidence=round(confidence, 3),
        method=ADAPTIVE_METHOD,
        sample_size=len(normalized),
        ignored_words=ignored_words,
    )


def _normalize_responses(
    word_ranks: dict[str, WordRank],
    responses: Iterable[AdaptiveResponse | tuple[str, str]],
) -> tuple[list[AdaptiveResponse], list[str]]:
    normalized: list[AdaptiveResponse] = []
    ignored_words: list[str] = []
    ignored_seen: set[str] = set()
    for response in responses:
        word, status = (response.word, response.status) if isinstance(response, AdaptiveResponse) else response
        normalized_word = normalize_word(word)
        if not normalized_word:
            continue
        if normalized_word not in word_ranks:
            if normalized_word not in ignored_seen:
                ignored_seen.add(normalized_word)
                ignored_words.append(normalized_word)
            continue
        if status not in ADAPTIVE_STATUSES:
            raise ValueError(f"unsupported adaptive status: {status}")
        normalized.append(AdaptiveResponse(normalized_word, cast(AdaptiveStatus, status)))
    return normalized, ignored_words


def _sorted_ranks(word_ranks: dict[str, WordRank]) -> list[WordRank]:
    ranks = sorted(word_ranks.values(), key=lambda item: item.rank)
    if not ranks:
        raise ValueError("word rank table is empty")
    return ranks


def _next_target_rank(
    ranks: Sequence[WordRank],
    responses: Sequence[AdaptiveResponse],
    start_rank: int,
) -> int:
    max_rank = ranks[-1].rank
    if not responses:
        return _clamp(start_rank, 1, max_rank)

    rank_by_word = {rank.word: rank.rank for rank in ranks}
    last = responses[-1]
    last_rank = rank_by_word[last.word]
    known_answer_ranks = [rank_by_word[item.word] for item in responses if item.status == "known"]
    unknown_answer_ranks = [rank_by_word[item.word] for item in responses if item.status == "unknown"]

    if known_answer_ranks and unknown_answer_ranks:
        lower = max(known_answer_ranks)
        upper = min(unknown_answer_ranks)
        if lower < upper:
            return _clamp((lower + upper) // 2, 1, max_rank)

    step = max(300, int(last_rank * 0.65))
    if last.status == "known":
        return _clamp(last_rank + step, 1, max_rank)
    if last.status == "unknown":
        return _clamp(last_rank - step, 1, max_rank)
    return _clamp(last_rank + max(150, int(step * 0.2)), 1, max_rank)


def _pick_word(
    ranks: Sequence[WordRank],
    responses: Sequence[AdaptiveResponse],
    target_rank: int,
    seed: int | None,
) -> TestWord:
    answered_words = {response.word for response in responses}
    available = [rank for rank in ranks if rank.word not in answered_words]
    if not available:
        raise ValueError("no words available for adaptive test")

    candidates = sorted(available, key=lambda item: abs(item.rank - target_rank))[: min(8, len(available))]
    rng = random.Random((seed or 2026) + len(responses) * 7919 + target_rank)
    chosen = candidates[rng.randrange(len(candidates))]
    return TestWord(word=chosen.word, rank=chosen.rank, stage=len(responses) + 1)


def _should_stop(
    responses: Sequence[AdaptiveResponse],
    estimate: EstimateResult | None,
    min_items: int,
    max_items: int,
) -> bool:
    if len(responses) >= max_items:
        return True
    if len(responses) < min_items or estimate is None:
        return False
    return (estimate.range_high - estimate.range_low) <= max(400, int(estimate.estimate * 0.18))


def _estimate_range(
    estimate: int,
    known_ranks: Sequence[int],
    unknown_ranks: Sequence[int],
    valid_ranks: Sequence[int],
    uncertain_count: int,
) -> tuple[int, int]:
    if known_ranks and unknown_ranks and max(known_ranks) < min(unknown_ranks):
        lower = max(known_ranks)
        upper = min(unknown_ranks)
    else:
        spread = max(500, int(max(estimate, 1) * 0.3))
        lower = max(0, estimate - spread)
        upper = estimate + spread

    if valid_ranks:
        lower = min(lower, max(valid_ranks))
        upper = max(upper, min(valid_ranks))
    if uncertain_count:
        widen = max(150, int((upper - lower) * 0.15))
        lower = max(0, lower - widen)
        upper += widen
    return max(0, int(lower)), max(0, int(upper))


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))
