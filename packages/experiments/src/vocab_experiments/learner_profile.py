from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

from vocab_estimator import VocabularyResponse, estimate_vocabulary, load_word_ranks, tokenize

LEARNER_ORDER = ("C", "F", "P", "K")


@dataclass(frozen=True)
class LearnerProfileResult:
    learner_class: str
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    known_count: int
    unknown_count: int
    method: str
    ignored_words: list[str]


def estimate_learner_profiles(
    sample_paths: dict[str, str | Path],
    word_rank_csv: str | Path,
    output_csv: str | Path,
    *,
    bootstrap_iterations: int = 200,
) -> list[LearnerProfileResult]:
    word_ranks = load_word_ranks(word_rank_csv)
    tokens_by_class = {
        label: _ranked_tokens(path, word_ranks)
        for label, path in sample_paths.items()
        if label in LEARNER_ORDER
    }
    missing = [label for label in LEARNER_ORDER if label not in tokens_by_class]
    if missing:
        raise ValueError(f"missing sample classes: {', '.join(missing)}")

    results: list[LearnerProfileResult] = []
    for label in LEARNER_ORDER:
        known_words = _known_words(label, tokens_by_class)
        unknown_words = _unknown_words(label, tokens_by_class)
        responses = [
            *(VocabularyResponse(word, True) for word in known_words),
            *(VocabularyResponse(word, False) for word in unknown_words),
        ]
        estimate = estimate_vocabulary(word_ranks, responses, bootstrap_iterations=bootstrap_iterations)
        results.append(
            LearnerProfileResult(
                learner_class=label,
                estimate=estimate.estimate,
                range_low=estimate.range_low,
                range_high=estimate.range_high,
                confidence=estimate.confidence,
                known_count=len(known_words),
                unknown_count=len(unknown_words),
                method=f"learner_profile_{estimate.method}",
                ignored_words=estimate.ignored_words,
            )
        )
    _write_results(output_csv, results)
    return results


def _ranked_tokens(path: str | Path, word_ranks: dict) -> list[str]:
    tokens = sorted(set(tokenize(Path(path).read_text(encoding="utf-8"))))
    return sorted(
        [token for token in tokens if token in word_ranks],
        key=lambda token: word_ranks[token].rank,
    )


def _known_words(label: str, tokens_by_class: dict[str, list[str]]) -> list[str]:
    index = LEARNER_ORDER.index(label)
    known: set[str] = set()
    for lower_or_equal in LEARNER_ORDER[index:]:
        known.update(tokens_by_class[lower_or_equal])
    return sorted(known)


def _unknown_words(label: str, tokens_by_class: dict[str, list[str]]) -> list[str]:
    index = LEARNER_ORDER.index(label)
    unknown: set[str] = set()
    for higher in LEARNER_ORDER[:index]:
        ranked = tokens_by_class[higher]
        start = max(0, len(ranked) // 2)
        unknown.update(ranked[start:])
    unknown.difference_update(_known_words(label, tokens_by_class))
    return sorted(unknown)


def _write_results(output_csv: str | Path, results: list[LearnerProfileResult]) -> None:
    output = Path(output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "learner_class",
                "estimate",
                "range_low",
                "range_high",
                "confidence",
                "known_count",
                "unknown_count",
                "method",
                "ignored_words",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for result in results:
            writer.writerow(
                {
                    "learner_class": result.learner_class,
                    "estimate": result.estimate,
                    "range_low": result.range_low,
                    "range_high": result.range_high,
                    "confidence": result.confidence,
                    "known_count": result.known_count,
                    "unknown_count": result.unknown_count,
                    "method": result.method,
                    "ignored_words": ";".join(result.ignored_words),
                }
            )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Estimate learner profiles from C/F/P/K sample texts.")
    parser.add_argument("--word-rank", required=True, help="word_rank.csv path.")
    parser.add_argument("--output", required=True, help="Output learner profile CSV path.")
    parser.add_argument("--bootstrap-iterations", type=int, default=200)
    parser.add_argument("texts", nargs=4, help="Sample paths in C F P K order.")
    args = parser.parse_args(argv)
    labels = dict(zip(LEARNER_ORDER, args.texts))
    results = estimate_learner_profiles(
        labels,
        args.word_rank,
        args.output,
        bootstrap_iterations=args.bootstrap_iterations,
    )
    print(f"wrote {len(results)} learner profile rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
