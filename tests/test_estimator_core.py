from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from vocab_estimator import (
    VocabularyResponse,
    estimate_vocabulary,
    load_word_ranks,
    normalize_word,
    parse_response_csv,
    parse_response_csv_text,
    tokenize,
)


class EstimatorCoreTests(unittest.TestCase):
    def test_normalizes_and_tokenizes_english_words(self) -> None:
        self.assertEqual(normalize_word(" Apple! "), "apple")
        self.assertEqual(tokenize("Apple, don't stop. 2026"), ["apple", "dont", "stop"])

    def test_load_word_ranks_reads_csv_and_keeps_best_duplicate_rank(self) -> None:
        ranks = load_word_ranks(
            _write_csv(
                "word,rank,frequency,source\n"
                "the,1,0.071,fixture\n"
                "The,3,0.050,duplicate\n"
                "recite,8003,0.00001,fixture\n"
            )
        )

        self.assertEqual(ranks["the"].rank, 1)
        self.assertEqual(ranks["recite"].rank, 8003)
        self.assertEqual(ranks["recite"].source, "fixture")

    def test_parse_response_csv_accepts_known_unknown_and_chinese_statuses(self) -> None:
        responses = parse_response_csv(
            _write_csv(
                "word,status\n"
                "apple,known\n"
                "exemplify,unknown\n"
                "recite,认识\n"
                "oblivion,不认识\n"
            )
        )

        self.assertEqual(
            [(response.word, response.known) for response in responses],
            [
                ("apple", True),
                ("exemplify", False),
                ("recite", True),
                ("oblivion", False),
            ],
        )

    def test_parse_response_csv_text_accepts_uploaded_csv_content(self) -> None:
        responses = parse_response_csv_text("word,status\napple,known\nrare,unknown\n")

        self.assertEqual(
            [(response.word, response.known) for response in responses],
            [("apple", True), ("rare", False)],
        )

    def test_estimate_vocabulary_uses_rank_threshold_and_ignores_missing_words(self) -> None:
        ranks = load_word_ranks(
            _write_rank_fixture(
                [
                    ("alpha", 100),
                    ("bravo", 200),
                    ("charlie", 300),
                    ("delta", 400),
                    ("echo", 500),
                    ("foxtrot", 600),
                ]
            )
        )

        result = estimate_vocabulary(
            ranks,
            [
                VocabularyResponse("alpha", True),
                VocabularyResponse("bravo", True),
                VocabularyResponse("charlie", True),
                VocabularyResponse("delta", False),
                VocabularyResponse("echo", False),
                VocabularyResponse("foxtrot", False),
                VocabularyResponse("missing", False),
            ],
            bootstrap_iterations=0,
        )

        self.assertEqual(result.estimate, 300)
        self.assertEqual(result.range_low, 300)
        self.assertEqual(result.range_high, 300)
        self.assertEqual(result.sample_size, 6)
        self.assertEqual(result.ignored_words, ["missing"])
        self.assertEqual(result.method, "rank_midpoint_bootstrap_v1")

    def test_bootstrap_returns_deterministic_range_and_confidence(self) -> None:
        ranks = load_word_ranks(
            _write_rank_fixture(
                [
                    ("a", 100),
                    ("b", 200),
                    ("c", 300),
                    ("d", 400),
                    ("e", 500),
                    ("f", 600),
                    ("g", 700),
                    ("h", 800),
                ]
            )
        )
        responses = [
            ("a", True),
            ("b", True),
            ("c", True),
            ("d", False),
            ("e", True),
            ("f", False),
            ("g", False),
            ("h", False),
        ]

        result = estimate_vocabulary(ranks, responses, bootstrap_iterations=100, seed=7)

        self.assertLessEqual(result.range_low, result.estimate)
        self.assertGreaterEqual(result.range_high, result.estimate)
        self.assertGreater(result.confidence, 0)
        self.assertLessEqual(result.confidence, 0.9)


def _write_rank_fixture(entries: list[tuple[str, int]]) -> Path:
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False)
    with handle:
        writer = csv.writer(handle)
        writer.writerow(["word", "rank", "frequency", "source"])
        for word, rank in entries:
            writer.writerow([word, rank, "0.0", "fixture"])
    return Path(handle.name)


def _write_csv(content: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False)
    with handle:
        handle.write(content)
    return Path(handle.name)


if __name__ == "__main__":
    unittest.main()
