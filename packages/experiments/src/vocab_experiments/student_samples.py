from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import fmean, pstdev


@dataclass(frozen=True)
class StudentSummary:
    student_code: str
    cet4_score: int
    cet6_score: int
    runs: int
    estimate_mean: float
    estimate_stddev: float


SAMPLE_ROWS = [
    ("S001", 430, 0, 1, 3650),
    ("S001", 430, 0, 2, 3880),
    ("S001", 430, 0, 3, 3720),
    ("S002", 498, 420, 1, 5150),
    ("S002", 498, 420, 2, 5360),
    ("S002", 498, 420, 3, 5280),
    ("S003", 561, 512, 1, 6420),
    ("S003", 561, 512, 2, 6680),
    ("S003", 561, 512, 3, 6510),
    ("S004", 612, 548, 1, 7480),
    ("S004", 612, 548, 2, 7690),
    ("S004", 612, 548, 3, 7550),
]


def write_student_sample_outputs(
    raw_csv: str | Path,
    summary_csv: str | Path,
    correlation_json: str | Path | None = None,
) -> list[StudentSummary]:
    _write_raw(raw_csv)
    summaries = _summarize_samples()
    _write_summary(summary_csv, summaries)
    if correlation_json is not None:
        _write_correlation(correlation_json, summaries)
    return summaries


def _write_raw(raw_csv: str | Path) -> None:
    output = Path(raw_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["student_code", "cet4_score", "cet6_score", "run", "estimate"])
        writer.writerows(SAMPLE_ROWS)


def _summarize_samples() -> list[StudentSummary]:
    groups: dict[str, list[tuple[int, int, int]]] = defaultdict(list)
    for student_code, cet4_score, cet6_score, _run, estimate in SAMPLE_ROWS:
        groups[student_code].append((cet4_score, cet6_score, estimate))
    summaries: list[StudentSummary] = []
    for student_code, rows in sorted(groups.items()):
        estimates = [estimate for _cet4, _cet6, estimate in rows]
        summaries.append(
            StudentSummary(
                student_code=student_code,
                cet4_score=rows[0][0],
                cet6_score=rows[0][1],
                runs=len(rows),
                estimate_mean=round(fmean(estimates), 3),
                estimate_stddev=round(pstdev(estimates), 3),
            )
        )
    return summaries


def _write_summary(summary_csv: str | Path, summaries: list[StudentSummary]) -> None:
    output = Path(summary_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "student_code",
                "cet4_score",
                "cet6_score",
                "runs",
                "estimate_mean",
                "estimate_stddev",
            ],
        )
        writer.writeheader()
        for row in summaries:
            writer.writerow(row.__dict__)


def _write_correlation(correlation_json: str | Path, summaries: list[StudentSummary]) -> None:
    output = Path(correlation_json)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "cet4_estimate_correlation": _pearson(
                    [row.cet4_score for row in summaries],
                    [row.estimate_mean for row in summaries],
                ),
                "cet6_estimate_correlation": _pearson(
                    [row.cet6_score for row in summaries if row.cet6_score > 0],
                    [row.estimate_mean for row in summaries if row.cet6_score > 0],
                ),
                "note": "匿名演示数据，仅用于报告格式展示。",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) != len(ys) or len(xs) < 2:
        return None
    mean_x = fmean(xs)
    mean_y = fmean(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator_x = sum((x - mean_x) ** 2 for x in xs)
    denominator_y = sum((y - mean_y) ** 2 for y in ys)
    if denominator_x == 0 or denominator_y == 0:
        return None
    return round(numerator / ((denominator_x * denominator_y) ** 0.5), 3)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write anonymized student sample report outputs.")
    parser.add_argument("--raw", required=True, help="Raw student sample CSV path.")
    parser.add_argument("--summary", required=True, help="Student summary CSV path.")
    parser.add_argument("--correlation", help="Optional correlation JSON path.")
    args = parser.parse_args(argv)
    summaries = write_student_sample_outputs(args.raw, args.summary, args.correlation)
    print(f"wrote {len(summaries)} student summary rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
