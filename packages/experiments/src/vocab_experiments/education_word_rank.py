from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from vocab_estimator import normalize_word


EDUCATION_LEVELS: tuple[str, ...] = ("zk", "gk", "cet4", "cet6", "ielts", "toefl", "gre")
SOURCE_NAME = "ecdict_education"
MATCHING_SOURCE_NAME = "ecdict_full"

_WORD_RE = re.compile(r"^[a-z]{2,}$")
_MATCHING_WORD_RE = re.compile(r"^[a-z]+$")
_EXCLUDED_WORDS = {"xhtml", "zshops", "abmodality"}
_ABBREVIATION_MARKERS = ("abbr", "缩写")


@dataclass
class EducationWord:
    word: str
    level: str
    tags: str
    translation: str
    bnc: int
    frq: int
    sequence: int = field(default=0)


def build_education_word_rank(
    ecdict_csv: str | Path,
    output_path: str | Path,
    *,
    limit: int | None = None,
) -> int:
    words = list(_iter_education_words(Path(ecdict_csv)))
    words.sort(key=_sort_key)
    if limit is not None:
        words = words[:limit]

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(
            target,
            fieldnames=[
                "word",
                "rank",
                "frequency",
                "source",
                "level",
                "tags",
                "translation",
                "bnc",
                "frq",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for rank, word in enumerate(words, start=1):
            writer.writerow({
                "word": word.word,
                "rank": rank,
                "frequency": _frequency_proxy(word),
                "source": SOURCE_NAME,
                "level": word.level,
                "tags": word.tags,
                "translation": word.translation,
                "bnc": word.bnc or "",
                "frq": word.frq or "",
            })
    return len(words)


def build_matching_wordlist(
    ecdict_csv: str | Path,
    output_path: str | Path,
    *,
    limit: int | None = None,
) -> int:
    words = sorted(_iter_matching_words(Path(ecdict_csv)))
    if limit is not None:
        words = words[:limit]

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(
            target,
            fieldnames=["word", "source"],
            lineterminator="\n",
        )
        writer.writeheader()
        for word in words:
            writer.writerow({"word": word, "source": MATCHING_SOURCE_NAME})
    return len(words)


def _iter_education_words(path: Path) -> list[EducationWord]:
    items: dict[str, EducationWord] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _require_columns(reader.fieldnames, {"word", "translation", "tag", "bnc", "frq"})
        for sequence, row in enumerate(reader):
            tags = _education_tags(row.get("tag", ""))
            if not tags:
                continue
            raw_word = (row.get("word") or "").strip().lower()
            if not _WORD_RE.fullmatch(raw_word):
                continue
            word = normalize_word(raw_word)
            translation = _clean_cell(row.get("translation", ""))
            if not _is_test_word(word, row, translation):
                continue
            item = EducationWord(
                word=word,
                level=tags[0],
                tags=" ".join(tags),
                translation=translation,
                bnc=_parse_int(row.get("bnc", "")),
                frq=_parse_int(row.get("frq", "")),
                sequence=sequence,
            )
            current = items.get(word)
            if current is None or _sort_key(item) < _sort_key(current):
                items[word] = item
    return list(items.values())


def _iter_matching_words(path: Path) -> set[str]:
    words: set[str] = set()
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        _require_columns(reader.fieldnames, {"word"})
        for row in reader:
            raw_word = (row.get("word") or "").strip().lower()
            if not _MATCHING_WORD_RE.fullmatch(raw_word):
                continue
            word = normalize_word(raw_word)
            if _MATCHING_WORD_RE.fullmatch(word):
                words.add(word)
    return words


def _education_tags(raw_tags: str) -> list[str]:
    tag_set = set(raw_tags.split())
    return [level for level in EDUCATION_LEVELS if level in tag_set]


def _is_test_word(word: str, row: dict[str, str], translation: str) -> bool:
    if not _WORD_RE.fullmatch(word):
        return False
    if word in _EXCLUDED_WORDS:
        return False
    definition = _clean_cell(row.get("definition", ""))
    text = f"{definition} {translation}".lower()
    return not any(marker in text for marker in _ABBREVIATION_MARKERS)


def _sort_key(word: EducationWord) -> tuple[int, int, int, str, int]:
    return (
        EDUCATION_LEVELS.index(word.level),
        _frequency_rank(word.frq),
        _frequency_rank(word.bnc),
        word.word,
        word.sequence,
    )


def _frequency_rank(value: int) -> int:
    return value if value > 0 else 999_999_999


def _frequency_proxy(word: EducationWord) -> str:
    rank = word.frq or word.bnc
    return f"{1 / rank:.8f}" if rank > 0 else "0.00000000"


def _parse_int(value: str | None) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def _clean_cell(value: str | None) -> str:
    return (value or "").replace("\\r\\n", " / ").replace("\r\n", " / ").replace("\n", " / ").strip()


def _require_columns(fieldnames: list[str] | None, required: set[str]) -> None:
    present = set(fieldnames or [])
    missing = sorted(required - present)
    if missing:
        raise ValueError(f"ECDICT CSV missing columns: {', '.join(missing)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build education-stage word_rank.csv from ECDICT.")
    parser.add_argument("--ecdict", required=True, help="Path to ECDICT ecdict.csv.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument("--limit", type=int, help="Maximum number of ranked words to write.")
    parser.add_argument("--matching-only", action="store_true", help="Write full ECDICT matching wordlist instead of education rank CSV.")
    args = parser.parse_args(argv)
    if args.matching_only:
        count = build_matching_wordlist(args.ecdict, args.output, limit=args.limit)
        print(f"wrote {count} ECDICT matching words to {args.output}")
    else:
        count = build_education_word_rank(args.ecdict, args.output, limit=args.limit)
        print(f"wrote {count} ECDICT education words to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
