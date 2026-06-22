from __future__ import annotations

import argparse
import csv
from pathlib import Path

from vocab_estimator import normalize_word


def build_word_rank(
    source_path: str | Path,
    output_path: str | Path,
    *,
    source_name: str = "google_10000",
    supplement_path: str | Path | None = None,
    limit: int | None = None,
) -> int:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    words: list[tuple[str, str]] = []
    _collect_words(Path(source_path), source_name, seen, words, limit)
    if supplement_path is not None and (limit is None or len(words) < limit):
        _collect_words(Path(supplement_path), "supplement", seen, words, limit)
    with output.open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target)
        writer.writerow(["word", "rank", "frequency", "source"])
        for rank, (word, source) in enumerate(words, start=1):
            writer.writerow([word, rank, _zipf_proxy(rank), source])
    return len(words)


def _collect_words(
    path: Path,
    source_name: str,
    seen: set[str],
    words: list[tuple[str, str]],
    limit: int | None,
) -> None:
    with path.open("r", encoding="utf-8") as source:
        for raw_word in source:
            if limit is not None and len(words) >= limit:
                return
            word = normalize_word(raw_word)
            if not word or word in seen:
                continue
            seen.add(word)
            words.append((word, source_name))


def _zipf_proxy(rank: int) -> str:
    return f"{1 / rank:.8f}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build word_rank.csv from a ranked word list.")
    parser.add_argument("--source", required=True, help="Input ranked word list, one word per line.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument("--source-name", default="google_10000", help="Source label written to CSV.")
    parser.add_argument("--supplement", help="Optional supplemental word list used after source words.")
    parser.add_argument("--limit", type=int, help="Maximum number of ranked words to write.")
    args = parser.parse_args(argv)
    count = build_word_rank(
        args.source,
        args.output,
        source_name=args.source_name,
        supplement_path=args.supplement,
        limit=args.limit,
    )
    print(f"wrote {count} ranked words to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
