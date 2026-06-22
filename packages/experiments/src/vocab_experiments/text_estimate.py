from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

from vocab_estimator import load_word_ranks, tokenize

METHOD = "text_rank_percentile_v1"


@dataclass(frozen=True)
class TextEstimateResult:
    text_path: str
    estimate: int
    range_low: int
    range_high: int
    confidence: float
    method: str
    unique_words: int
    matched_words: int
    ignored_words: list[str]


def estimate_text_file(
    text_path: str | Path,
    word_rank_csv: str | Path,
    *,
    output_csv: str | Path | None = None,
) -> TextEstimateResult:
    ranks = load_word_ranks(word_rank_csv)
    text = Path(text_path).read_text(encoding="utf-8")
    unique_tokens = sorted(set(tokenize(text)))
    matched_ranks = sorted(ranks[token].rank for token in unique_tokens if token in ranks)
    ignored_words = [token for token in unique_tokens if token not in ranks]
    if not matched_ranks:
        raise ValueError("text does not contain words found in the word rank table")
    result = TextEstimateResult(
        text_path=str(text_path),
        estimate=_percentile(matched_ranks, 0.90),
        range_low=_percentile(matched_ranks, 0.75),
        range_high=_percentile(matched_ranks, 0.95),
        confidence=_confidence(len(unique_tokens), len(matched_ranks)),
        method=METHOD,
        unique_words=len(unique_tokens),
        matched_words=len(matched_ranks),
        ignored_words=ignored_words,
    )
    if output_csv is not None:
        _write_result(output_csv, [result])
    return result


def estimate_text_files(
    text_paths: list[str | Path],
    word_rank_csv: str | Path,
    output_csv: str | Path,
) -> list[TextEstimateResult]:
    results = [estimate_text_file(path, word_rank_csv) for path in text_paths]
    _write_result(output_csv, results)
    return results


def _write_result(output_csv: str | Path, results: list[TextEstimateResult]) -> None:
    output = Path(output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "text_path",
                "estimate",
                "range_low",
                "range_high",
                "confidence",
                "method",
                "unique_words",
                "matched_words",
                "ignored_words",
            ],
        )
        writer.writeheader()
        for result in results:
            writer.writerow(
                {
                    "text_path": result.text_path,
                    "estimate": result.estimate,
                    "range_low": result.range_low,
                    "range_high": result.range_high,
                    "confidence": result.confidence,
                    "method": result.method,
                    "unique_words": result.unique_words,
                    "matched_words": result.matched_words,
                    "ignored_words": ";".join(result.ignored_words),
                }
            )


def _percentile(values: list[int], ratio: float) -> int:
    index = round((len(values) - 1) * ratio)
    return values[max(0, min(len(values) - 1, index))]


def _confidence(unique_words: int, matched_words: int) -> float:
    coverage = matched_words / unique_words if unique_words else 0
    sample_factor = min(1.0, matched_words / 200)
    return round(0.9 * coverage * max(0.25, sample_factor), 3)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Estimate vocabulary level from text files.")
    parser.add_argument("--word-rank", required=True, help="word_rank.csv path.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument("texts", nargs="+", help="Text files to estimate.")
    args = parser.parse_args(argv)
    results = estimate_text_files(args.texts, args.word_rank, args.output)
    print(f"wrote {len(results)} text estimate rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

