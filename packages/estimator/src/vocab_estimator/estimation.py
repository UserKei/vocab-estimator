from __future__ import annotations

import random
from collections.abc import Iterable, Sequence

from .models import EstimateResult, VocabularyResponse, WordRank
from .text import normalize_word

METHOD = "rank_midpoint_bootstrap_v1"


def estimate_vocabulary(
    word_ranks: dict[str, WordRank],
    responses: Iterable[VocabularyResponse | tuple[str, bool]],
    *,
    bootstrap_iterations: int = 400,
    confidence_level: float = 0.9,
    seed: int = 2026,
) -> EstimateResult:
    observed, ignored_words = _map_responses(word_ranks, responses)
    if not observed:
        raise ValueError("at least one response must match the word rank table")

    estimate, error_rate = _estimate_threshold(observed)
    if bootstrap_iterations > 0 and len(observed) > 1:
        estimates = _bootstrap_estimates(observed, bootstrap_iterations, seed)
        range_low, range_high = _percentile_range(estimates, confidence_level)
    else:
        range_low = range_high = estimate

    confidence = _confidence(confidence_level, len(observed), error_rate, range_low, range_high)
    return EstimateResult(
        estimate=estimate,
        range_low=range_low,
        range_high=range_high,
        confidence=confidence,
        method=METHOD,
        sample_size=len(observed),
        ignored_words=ignored_words,
    )


def _map_responses(
    word_ranks: dict[str, WordRank],
    responses: Iterable[VocabularyResponse | tuple[str, bool]],
) -> tuple[list[tuple[int, bool]], list[str]]:
    observed: list[tuple[int, bool]] = []
    ignored_words: list[str] = []
    ignored_seen: set[str] = set()
    for response in responses:
        word, known = (response.word, response.known) if isinstance(response, VocabularyResponse) else response
        normalized = normalize_word(word)
        if not normalized:
            continue
        rank = word_ranks.get(normalized)
        if rank is None:
            if normalized not in ignored_seen:
                ignored_seen.add(normalized)
                ignored_words.append(normalized)
            continue
        observed.append((rank.rank, bool(known)))
    return observed, ignored_words


def _estimate_threshold(observed: Sequence[tuple[int, bool]]) -> tuple[int, float]:
    grouped: dict[int, list[bool]] = {}
    for rank, known in observed:
        grouped.setdefault(rank, []).append(known)
    ranks = sorted(grouped)
    median_rank = _median(ranks)
    known_above = sum(1 for _, known in observed if known)
    unknown_below = 0
    best_rank = 0
    best_errors = known_above
    for rank in ranks:
        for known in grouped[rank]:
            if known:
                known_above -= 1
            else:
                unknown_below += 1
        errors = known_above + unknown_below
        if errors < best_errors or (
            errors == best_errors and abs(rank - median_rank) < abs(best_rank - median_rank)
        ):
            best_rank = rank
            best_errors = errors
    return max(0, int(best_rank)), best_errors / len(observed)


def _bootstrap_estimates(
    observed: Sequence[tuple[int, bool]],
    iterations: int,
    seed: int,
) -> list[int]:
    rng = random.Random(seed)
    estimates: list[int] = []
    for _ in range(iterations):
        sample = [observed[rng.randrange(len(observed))] for _ in observed]
        estimate, _ = _estimate_threshold(sample)
        estimates.append(estimate)
    return estimates


def _percentile_range(values: Sequence[int], confidence_level: float) -> tuple[int, int]:
    ordered = sorted(values)
    alpha = max(0.0, min(1.0, 1.0 - confidence_level))
    low_index = int((alpha / 2) * (len(ordered) - 1))
    high_index = int((1 - alpha / 2) * (len(ordered) - 1))
    return ordered[low_index], ordered[high_index]


def _confidence(
    confidence_level: float,
    sample_size: int,
    error_rate: float,
    range_low: int,
    range_high: int,
) -> float:
    sample_factor = min(1.0, sample_size / 120)
    consistency_factor = max(0.2, 1.0 - error_rate)
    width_penalty = 1.0
    if range_high > 0:
        width_penalty = max(0.25, 1.0 - ((range_high - range_low) / range_high))
    return round(confidence_level * sample_factor * consistency_factor * width_penalty, 3)


def _median(values: Sequence[int]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[middle])
    return (ordered[middle - 1] + ordered[middle]) / 2
