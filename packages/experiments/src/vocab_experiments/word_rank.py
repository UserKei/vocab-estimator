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
) -> int:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    count = 0
    with Path(source_path).open("r", encoding="utf-8") as source, output.open(
        "w", encoding="utf-8", newline=""
    ) as target:
        writer = csv.writer(target)
        writer.writerow(["word", "rank", "frequency", "source"])
        for raw_word in source:
            word = normalize_word(raw_word)
            if not word or word in seen:
                continue
            seen.add(word)
            count += 1
            writer.writerow([word, count, "0.0", source_name])
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build word_rank.csv from a ranked word list.")
    parser.add_argument("--source", required=True, help="Input ranked word list, one word per line.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument("--source-name", default="google_10000", help="Source label written to CSV.")
    args = parser.parse_args(argv)
    count = build_word_rank(args.source, args.output, source_name=args.source_name)
    print(f"wrote {count} ranked words to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

