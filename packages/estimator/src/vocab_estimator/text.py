from __future__ import annotations

import re

_TOKEN_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")


def normalize_word(word: str) -> str:
    match = _TOKEN_RE.search(word.strip().lower())
    return match.group(0).replace("'", "") if match else ""


def tokenize(text: str) -> list[str]:
    return [match.group(0).lower().replace("'", "") for match in _TOKEN_RE.finditer(text)]

