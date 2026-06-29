from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

from vocab_estimator import load_word_ranks, normalize_word, tokenize

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
    ranked_words: int
    unranked_words: list[str]
    ignored_words: list[str]


def estimate_text_file(
    text_path: str | Path,
    word_rank_csv: str | Path,
    *,
    matching_wordlist_csv: str | Path | None = None,
    output_csv: str | Path | None = None,
) -> TextEstimateResult:
    ranks = load_word_ranks(word_rank_csv)
    matching_words = _load_matching_words(matching_wordlist_csv) if matching_wordlist_csv else set(ranks)
    text = Path(text_path).read_text(encoding="utf-8")
    unique_tokens = sorted(set(tokenize(text)))
    ranked_tokens: list[str] = []
    unranked_words: list[str] = []
    ignored_words: list[str] = []
    matched_ranks: list[int] = []
    for token in unique_tokens:
        ranked_token = _ranked_token(token, ranks)
        if ranked_token is not None:
            ranked_tokens.append(token)
            matched_ranks.append(ranks[ranked_token].rank)
        elif _matching_token(token, matching_words) is not None:
            unranked_words.append(token)
        else:
            ignored_words.append(token)
    matched_ranks.sort()
    if not matched_ranks:
        raise ValueError("text does not contain words found in the word rank table")
    matched_words = len(ranked_tokens) + len(unranked_words)
    result = TextEstimateResult(
        text_path=str(text_path),
        estimate=_percentile(matched_ranks, 0.90),
        range_low=_percentile(matched_ranks, 0.75),
        range_high=_percentile(matched_ranks, 0.95),
        confidence=_confidence(len(unique_tokens), matched_words, len(ranked_tokens)),
        method=METHOD,
        unique_words=len(unique_tokens),
        matched_words=matched_words,
        ranked_words=len(ranked_tokens),
        unranked_words=unranked_words,
        ignored_words=ignored_words,
    )
    if output_csv is not None:
        _write_result(output_csv, [result])
    return result


def estimate_text_files(
    text_paths: list[str | Path],
    word_rank_csv: str | Path,
    output_csv: str | Path,
    *,
    matching_wordlist_csv: str | Path | None = None,
) -> list[TextEstimateResult]:
    results = [
        estimate_text_file(path, word_rank_csv, matching_wordlist_csv=matching_wordlist_csv)
        for path in text_paths
    ]
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
                "ranked_words",
                "unranked_words",
                "ignored_words",
            ],
            lineterminator="\n",
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
                    "ranked_words": result.ranked_words,
                    "unranked_words": ";".join(result.unranked_words),
                    "ignored_words": ";".join(result.ignored_words),
                }
            )


def _percentile(values: list[int], ratio: float) -> int:
    index = round((len(values) - 1) * ratio)
    return values[max(0, min(len(values) - 1, index))]


def _confidence(unique_words: int, matched_words: int, ranked_words: int) -> float:
    coverage = matched_words / unique_words if unique_words else 0
    sample_factor = min(1.0, ranked_words / 200)
    return round(0.9 * coverage * max(0.25, sample_factor), 3)


def _load_matching_words(path: str | Path) -> set[str]:
    words: set[str] = set()
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if "word" not in set(reader.fieldnames or []):
            raise ValueError("matching wordlist CSV missing column: word")
        for row in reader:
            word = normalize_word(row.get("word", ""))
            if word:
                words.add(word)
    return words


def _ranked_token(token: str, ranks: dict) -> str | None:
    for candidate in _token_candidates(token):
        if candidate in ranks:
            return candidate
    return None


def _matching_token(token: str, matching_words: set[str]) -> str | None:
    for candidate in _token_candidates(token):
        if candidate in matching_words:
            return candidate
    return None


def _token_candidates(token: str) -> list[str]:
    candidates = [token]
    if len(token) > 4 and token.endswith("ies"):
        candidates.append(f"{token[:-3]}y")
    if len(token) > 3 and token.endswith("es"):
        candidates.append(token[:-2])
    if len(token) > 3 and token.endswith("s"):
        candidates.append(token[:-1])
    if len(token) > 4 and token.endswith("ied"):
        candidates.append(f"{token[:-3]}y")
    if len(token) > 4 and token.endswith("ed"):
        stem = token[:-2]
        candidates.extend(_stem_candidates(stem))
    if len(token) > 5 and token.endswith("ing"):
        stem = token[:-3]
        candidates.extend(_stem_candidates(stem))
        candidates.append(f"{stem}e")
    return list(dict.fromkeys(candidates))


def _stem_candidates(stem: str) -> list[str]:
    candidates = [stem]
    if len(stem) > 2 and stem[-1] == stem[-2]:
        candidates.append(stem[:-1])
    return candidates


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Estimate vocabulary level from text files.")
    parser.add_argument("--word-rank", required=True, help="word_rank.csv path.")
    parser.add_argument("--matching-wordlist", help="Optional full wordlist used for text coverage matching.")
    parser.add_argument("--output", required=True, help="Output CSV path.")
    parser.add_argument("texts", nargs="+", help="Text files to estimate.")
    args = parser.parse_args(argv)
    results = estimate_text_files(
        args.texts,
        args.word_rank,
        args.output,
        matching_wordlist_csv=args.matching_wordlist,
    )
    print(f"wrote {len(results)} text estimate rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
