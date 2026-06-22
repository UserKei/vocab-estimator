from __future__ import annotations

import argparse
import csv
from pathlib import Path

from vocab_estimator import EstimateResult, estimate_vocabulary, load_word_ranks, parse_response_csv


def run_batch(
    responses_csv: str | Path,
    word_rank_csv: str | Path,
    *,
    output_csv: str | Path | None = None,
    bootstrap_iterations: int = 400,
) -> EstimateResult:
    ranks = load_word_ranks(word_rank_csv)
    responses = parse_response_csv(responses_csv)
    result = estimate_vocabulary(ranks, responses, bootstrap_iterations=bootstrap_iterations)
    if output_csv is not None:
        _write_result(output_csv, result)
    return result


def _write_result(output_csv: str | Path, result: EstimateResult) -> None:
    output = Path(output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "estimate",
                "range_low",
                "range_high",
                "confidence",
                "method",
                "sample_size",
                "ignored_words",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "estimate": result.estimate,
                "range_low": result.range_low,
                "range_high": result.range_high,
                "confidence": result.confidence,
                "method": result.method,
                "sample_size": result.sample_size,
                "ignored_words": ";".join(result.ignored_words),
            }
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Estimate vocabulary size from a response CSV.")
    parser.add_argument("--responses", required=True, help="Input CSV with word,status columns.")
    parser.add_argument("--word-rank", required=True, help="word_rank.csv path.")
    parser.add_argument("--output", required=True, help="Output result CSV path.")
    parser.add_argument("--bootstrap-iterations", type=int, default=400)
    args = parser.parse_args(argv)
    result = run_batch(
        args.responses,
        args.word_rank,
        output_csv=args.output,
        bootstrap_iterations=args.bootstrap_iterations,
    )
    print(
        f"estimate={result.estimate} "
        f"range={result.range_low}-{result.range_high} "
        f"confidence={result.confidence}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

