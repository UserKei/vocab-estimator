from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import fmean, pstdev, pvariance


@dataclass(frozen=True)
class StabilitySummaryRow:
    unknown_ratio: float
    sample_length: int
    runs: int
    estimate_mean: float
    estimate_variance: float
    estimate_stddev: float
    range_low_mean: float
    range_high_mean: float
    range_width_mean: float
    confidence_mean: float


def summarize_stability(
    stability_csv: str | Path,
    output_csv: str | Path,
    output_json: str | Path,
    output_svg: str | Path,
) -> list[StabilitySummaryRow]:
    groups: dict[tuple[float, int], list[dict[str, str]]] = defaultdict(list)
    with Path(stability_csv).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _require_columns(
            reader.fieldnames,
            {
                "unknown_ratio",
                "sample_length",
                "estimate",
                "range_low",
                "range_high",
                "confidence",
            },
        )
        for row in reader:
            key = (float(row["unknown_ratio"]), int(row["sample_length"]))
            groups[key].append(row)

    summaries = [
        _summarize_group(unknown_ratio, sample_length, rows)
        for (unknown_ratio, sample_length), rows in sorted(groups.items())
    ]
    _write_summary_csv(output_csv, summaries)
    _write_summary_json(output_json, summaries)
    _write_summary_svg(output_svg, summaries)
    return summaries


def _summarize_group(
    unknown_ratio: float,
    sample_length: int,
    rows: list[dict[str, str]],
) -> StabilitySummaryRow:
    estimates = [float(row["estimate"]) for row in rows]
    range_lows = [float(row["range_low"]) for row in rows]
    range_highs = [float(row["range_high"]) for row in rows]
    range_widths = [high - low for low, high in zip(range_lows, range_highs)]
    confidences = [float(row["confidence"]) for row in rows]
    return StabilitySummaryRow(
        unknown_ratio=unknown_ratio,
        sample_length=sample_length,
        runs=len(rows),
        estimate_mean=round(fmean(estimates), 3),
        estimate_variance=round(pvariance(estimates), 3),
        estimate_stddev=round(pstdev(estimates), 3),
        range_low_mean=round(fmean(range_lows), 3),
        range_high_mean=round(fmean(range_highs), 3),
        range_width_mean=round(fmean(range_widths), 3),
        confidence_mean=round(fmean(confidences), 3),
    )


def _write_summary_csv(output_csv: str | Path, rows: list[StabilitySummaryRow]) -> None:
    output = Path(output_csv)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "unknown_ratio",
                "sample_length",
                "runs",
                "estimate_mean",
                "estimate_variance",
                "estimate_stddev",
                "range_low_mean",
                "range_high_mean",
                "range_width_mean",
                "confidence_mean",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({key: _format_number(value) for key, value in asdict(row).items()})


def _write_summary_json(output_json: str | Path, rows: list[StabilitySummaryRow]) -> None:
    output = Path(output_json)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_summary_svg(output_svg: str | Path, rows: list[StabilitySummaryRow]) -> None:
    output = Path(output_svg)
    output.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        output.write_text(_empty_svg(), encoding="utf-8")
        return

    width = max(640, 90 * len(rows) + 120)
    height = 360
    chart_left = 70
    chart_top = 40
    chart_width = width - 110
    chart_height = 240
    max_estimate = max(row.estimate_mean for row in rows) or 1
    bar_width = max(24, min(56, chart_width // max(1, len(rows)) - 24))
    step = chart_width / max(1, len(rows))
    bars: list[str] = []
    for index, row in enumerate(rows):
        bar_height = chart_height * (row.estimate_mean / max_estimate)
        x = chart_left + index * step + (step - bar_width) / 2
        y = chart_top + chart_height - bar_height
        label = f"{int(row.unknown_ratio * 100)}%/{row.sample_length}"
        bars.append(
            "\n".join(
                [
                    f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_width}" height="{bar_height:.1f}" fill="#2563eb" />',
                    f'<text x="{x + bar_width / 2:.1f}" y="{chart_top + chart_height + 24}" text-anchor="middle" font-size="12">{label}</text>',
                    f'<text x="{x + bar_width / 2:.1f}" y="{max(18, y - 8):.1f}" text-anchor="middle" font-size="12">{_format_number(row.estimate_mean)}</text>',
                ]
            )
        )

    svg = "\n".join(
        [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            '<rect width="100%" height="100%" fill="#ffffff" />',
            '<text x="24" y="26" font-size="18" font-family="Arial, sans-serif">Stability estimate mean by group</text>',
            f'<line x1="{chart_left}" y1="{chart_top + chart_height}" x2="{chart_left + chart_width}" y2="{chart_top + chart_height}" stroke="#111827" />',
            f'<line x1="{chart_left}" y1="{chart_top}" x2="{chart_left}" y2="{chart_top + chart_height}" stroke="#111827" />',
            *bars,
            "</svg>",
        ]
    )
    output.write_text(svg, encoding="utf-8")


def _empty_svg() -> str:
    return '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="120"><text x="24" y="64">No stability rows</text></svg>'


def _format_number(value: object) -> object:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, float):
        return str(value).rstrip("0").rstrip(".")
    return value


def _require_columns(fieldnames: list[str] | None, required: set[str]) -> None:
    present = set(fieldnames or [])
    missing = sorted(required - present)
    if missing:
        raise ValueError(f"stability CSV missing columns: {', '.join(missing)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarize stability experiment outputs for reports.")
    parser.add_argument("--input", required=True, help="Input stability CSV path.")
    parser.add_argument("--csv", required=True, help="Output summary CSV path.")
    parser.add_argument("--json", required=True, help="Output summary JSON path.")
    parser.add_argument("--svg", required=True, help="Output SVG chart path.")
    args = parser.parse_args(argv)
    rows = summarize_stability(args.input, args.csv, args.json, args.svg)
    print(f"wrote {len(rows)} stability summary rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
