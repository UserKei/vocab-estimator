from __future__ import annotations

import csv
from io import StringIO
from pathlib import Path

from .models import VocabularyResponse
from .text import normalize_word

_KNOWN_STATUSES = {"known", "yes", "true", "1", "认识"}
_UNKNOWN_STATUSES = {"unknown", "no", "false", "0", "不认识"}


def parse_response_csv(path: str | Path) -> list[VocabularyResponse]:
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        return _parse_response_reader(handle)


def parse_response_csv_text(content: str) -> list[VocabularyResponse]:
    return _parse_response_reader(StringIO(content))


def _parse_response_reader(handle) -> list[VocabularyResponse]:
    responses: list[VocabularyResponse] = []
    reader = csv.DictReader(handle)
    _require_columns(reader.fieldnames, {"word", "status"})
    for line_number, row in enumerate(reader, start=2):
        word = normalize_word(row.get("word", ""))
        status = (row.get("status") or "").strip().lower()
        if not word:
            continue
        if status in _KNOWN_STATUSES:
            responses.append(VocabularyResponse(word=word, known=True))
        elif status in _UNKNOWN_STATUSES:
            responses.append(VocabularyResponse(word=word, known=False))
        else:
            raise ValueError(f"invalid response status at line {line_number}: {status}")
    return responses


def _require_columns(fieldnames: list[str] | None, required: set[str]) -> None:
    present = set(fieldnames or [])
    missing = sorted(required - present)
    if missing:
        raise ValueError(f"response CSV missing columns: {', '.join(missing)}")
