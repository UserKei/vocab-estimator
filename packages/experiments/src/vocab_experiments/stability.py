from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path
from typing import Iterable

from vocab_estimator import VocabularyResponse, estimate_vocabulary, load_word_ranks
from vocab_estimator.models import WordRank

DEFAULT_UNKNOWN_RATIOS = (0.1, 0.2, 0.3)
DEFAULT_SAMPLE_LENGTHS = (200, 300, 400)
DEFAULT_REPEATS = 100


def run_stability_experiment(
    word_rank_csv: str | Path,
    output_csv: str | Path,
    *,
    unknown_ratios: Iterable[float] = DEFAULT_UNKNOWN_RATIOS,
    sample_lengths: Iterable[int] = DEFAULT_SAMPLE_LENGTHS,
    repeats: int = DEFAULT_REPEATS,
    seed: int = 2026,
) -> int:
    ranks = sorted(load_word_ranks(word_rank_csv).values(), key=lambda item: item.rank)
    output = Path(output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    rows_written = 0
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "unknown_ratio",
                "sample_length",
                "repeat",
                "estimate",
                "range_low",
                "range_high",
                "confidence",
                "sample_size",
            ],
        )
        writer.writeheader()
        for unknown_ratio in unknown_ratios:
            for sample_length in sample_lengths:
                _validate_experiment(ranks, unknown_ratio, sample_length, repeats)
                for repeat_index in range(1, repeats + 1):
                    responses = _sample_responses(ranks, sample_length, unknown_ratio, rng)
                    result = estimate_vocabulary(
                        {rank.word: rank for rank in ranks},
                        responses,
                        bootstrap_iterations=0,
                    )
                    writer.writerow(
                        {
                            "unknown_ratio": unknown_ratio,
                            "sample_length": sample_length,
                            "repeat": repeat_index,
                            "estimate": result.estimate,
                            "range_low": result.range_low,
                            "range_high": result.range_high,
                            "confidence": result.confidence,
                            "sample_size": result.sample_size,
                        }
                    )
                    rows_written += 1
    return rows_written


def _sample_responses(
    ranks: list[WordRank],
    sample_length: int,
    unknown_ratio: float,
    rng: random.Random,
) -> list[VocabularyResponse]:
    sampled = sorted(rng.sample(ranks, sample_length), key=lambda item: item.rank)
    unknown_count = max(1, round(sample_length * unknown_ratio))
    known_cutoff = sample_length - unknown_count
    return [
        VocabularyResponse(rank.word, index < known_cutoff)
        for index, rank in enumerate(sampled)
    ]


def _validate_experiment(
    ranks: list[WordRank],
    unknown_ratio: float,
    sample_length: int,
    repeats: int,
) -> None:
    if not 0 < unknown_ratio < 1:
        raise ValueError("unknown_ratio must be between 0 and 1")
    if sample_length <= 1:
        raise ValueError("sample_length must be greater than 1")
    if sample_length > len(ranks):
        raise ValueError("sample_length cannot exceed word rank size")
    if repeats <= 0:
        raise ValueError("repeats must be positive")


def _parse_csv_numbers(raw: str, cast: type[float] | type[int]) -> list[float] | list[int]:
    return [cast(item.strip()) for item in raw.split(",") if item.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run vocabulary estimator stability experiments.")
    parser.add_argument("--word-rank", required=True, help="word_rank.csv path.")
    parser.add_argument("--output", required=True, help="Output stability CSV path.")
    parser.add_argument("--unknown-ratios", default="0.1,0.2,0.3")
    parser.add_argument("--sample-lengths", default="200,300,400")
    parser.add_argument("--repeats", type=int, default=100)
    parser.add_argument("--seed", type=int, default=2026)
    args = parser.parse_args(argv)
    rows = run_stability_experiment(
        args.word_rank,
        args.output,
        unknown_ratios=_parse_csv_numbers(args.unknown_ratios, float),
        sample_lengths=_parse_csv_numbers(args.sample_lengths, int),
        repeats=args.repeats,
        seed=args.seed,
    )
    print(f"wrote {rows} stability rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
