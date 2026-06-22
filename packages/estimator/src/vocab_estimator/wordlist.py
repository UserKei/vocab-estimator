from __future__ import annotations

import csv
from pathlib import Path

from .models import WordRank
from .text import normalize_word


def load_word_ranks(path: str | Path) -> dict[str, WordRank]:
    rows: dict[str, WordRank] = {}
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _require_columns(reader.fieldnames, {"word", "rank", "frequency", "source"})
        for line_number, row in enumerate(reader, start=2):
            word = normalize_word(row.get("word", ""))
            if not word:
                continue
            try:
                rank = int(row.get("rank", ""))
                frequency = float(row.get("frequency") or 0.0)
            except ValueError as exc:
                raise ValueError(f"invalid word rank row at line {line_number}: {row}") from exc
            if rank <= 0:
                raise ValueError(f"rank must be positive at line {line_number}: {row}")
            current = rows.get(word)
            if current is None or rank < current.rank:
                rows[word] = WordRank(
                    word=word,
                    rank=rank,
                    frequency=frequency,
                    source=row.get("source") or "unknown",
                )
    return rows


def _require_columns(fieldnames: list[str] | None, required: set[str]) -> None:
    present = set(fieldnames or [])
    missing = sorted(required - present)
    if missing:
        raise ValueError(f"word rank CSV missing columns: {', '.join(missing)}")

