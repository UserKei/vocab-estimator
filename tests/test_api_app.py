from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


class ApiAppTests(unittest.TestCase):
    def test_health_estimate_and_student_results_flow(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            word_rank = tmp_path / "word_rank.csv"
            database = tmp_path / "api.db"
            word_rank.write_text(
                "word,rank,frequency,source\n"
                "alpha,100,0.0,fixture\n"
                "bravo,200,0.0,fixture\n"
                "charlie,300,0.0,fixture\n"
                "delta,400,0.0,fixture\n",
                encoding="utf-8",
            )
            with _patched_env(word_rank, database):
                from vocab_api.main import create_app

                with TestClient(create_app()) as client:
                    self.assertEqual(client.get("/api/health").json(), {"status": "ok"})

                    estimate_response = client.post(
                        "/api/estimate",
                        json={
                            "responses": [
                                {"word": "alpha", "known": True},
                                {"word": "bravo", "known": True},
                                {"word": "charlie", "known": False},
                                {"word": "delta", "known": False},
                            ]
                        },
                    )
                    self.assertEqual(estimate_response.status_code, 200)
                    estimate = estimate_response.json()
                    self.assertEqual(estimate["estimate"], 200)
                    self.assertEqual(estimate["sample_size"], 4)

                    created_response = client.post(
                        "/api/student-results",
                        json={
                            "student_code": "S001",
                            "cet4_score": 520,
                            "cet6_score": 480,
                            "estimate": estimate["estimate"],
                            "range_low": estimate["range_low"],
                            "range_high": estimate["range_high"],
                            "confidence": estimate["confidence"],
                            "method": estimate["method"],
                            "responses": [{"word": "alpha", "known": True}],
                        },
                    )
                    self.assertEqual(created_response.status_code, 200)
                    self.assertEqual(created_response.json()["student_code"], "S001")

                    list_response = client.get("/api/student-results")
                    self.assertEqual(list_response.status_code, 200)
                    self.assertEqual(len(list_response.json()), 1)

                    batch_response = client.post(
                        "/api/batch",
                        files={
                            "file": (
                                "responses.csv",
                                "word,status\nalpha,known\nbravo,known\ncharlie,unknown\ndelta,unknown\n",
                                "text/csv",
                            )
                        },
                    )
                    self.assertEqual(batch_response.status_code, 200)
                    batch = batch_response.json()
                    self.assertEqual(batch["filename"], "responses.csv")
                    self.assertEqual(batch["estimate"], 200)
                    self.assertEqual(batch["row_count"], 4)

                    stability_output = tmp_path / "stability.csv"
                    stability_response = client.post(
                        "/api/experiments/stability",
                        json={
                            "output_path": str(stability_output),
                            "unknown_ratios": [0.25],
                            "sample_lengths": [4],
                            "repeats": 2,
                        },
                    )
                    self.assertEqual(stability_response.status_code, 200)
                    self.assertEqual(stability_response.json()["rows_written"], 2)
                    self.assertTrue(stability_output.exists())

                    text_path = tmp_path / "sample.txt"
                    text_output = tmp_path / "text_estimates.csv"
                    text_path.write_text("alpha bravo charlie delta", encoding="utf-8")
                    text_response = client.post(
                        "/api/experiments/text-estimate",
                        json={
                            "text_paths": [str(text_path)],
                            "output_path": str(text_output),
                        },
                    )
                    self.assertEqual(text_response.status_code, 200)
                    text_result = text_response.json()["results"][0]
                    self.assertEqual(text_result["text_path"], str(text_path))
                    self.assertEqual(text_result["unique_words"], 4)
                    self.assertEqual(text_result["matched_words"], 4)
                    self.assertTrue(text_output.exists())


class _patched_env:
    def __init__(self, word_rank: Path, database: Path) -> None:
        self.word_rank = word_rank
        self.database = database
        self.previous_word_rank: str | None = None
        self.previous_database: str | None = None

    def __enter__(self) -> None:
        import os

        self.previous_word_rank = os.environ.get("VOCAB_WORD_RANK_PATH")
        self.previous_database = os.environ.get("VOCAB_DATABASE_URL")
        os.environ["VOCAB_WORD_RANK_PATH"] = str(self.word_rank)
        os.environ["VOCAB_DATABASE_URL"] = f"sqlite:///{self.database}"
        _clear_api_caches()

    def __exit__(self, *args: object) -> None:
        import os

        if self.previous_word_rank is None:
            os.environ.pop("VOCAB_WORD_RANK_PATH", None)
        else:
            os.environ["VOCAB_WORD_RANK_PATH"] = self.previous_word_rank
        if self.previous_database is None:
            os.environ.pop("VOCAB_DATABASE_URL", None)
        else:
            os.environ["VOCAB_DATABASE_URL"] = self.previous_database
        _clear_api_caches()


def _clear_api_caches() -> None:
    try:
        from vocab_api.config import get_settings
        from vocab_api.services import load_default_word_ranks

        get_settings.cache_clear()
        load_default_word_ranks.cache_clear()
    except ModuleNotFoundError:
        return


if __name__ == "__main__":
    unittest.main()
