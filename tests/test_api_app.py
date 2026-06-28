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
                + "".join(f"{_word_name(i)},{i * 100},0.0,fixture\n" for i in range(1, 241)),
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
                                {"word": _word_name(1), "known": True},
                                {"word": _word_name(2), "known": True},
                                {"word": _word_name(3), "known": False},
                                {"word": _word_name(4), "known": False},
                            ]
                        },
                    )
                    self.assertEqual(estimate_response.status_code, 200)
                    estimate = estimate_response.json()
                    self.assertEqual(estimate["estimate"], 200)
                    self.assertEqual(estimate["sample_size"], 4)

                    session_response = client.post(
                        "/api/test-sessions",
                        json={"seed": 19, "stage1_size": 6},
                    )
                    self.assertEqual(session_response.status_code, 200)
                    session = session_response.json()
                    self.assertEqual(session["stage"], 1)
                    self.assertEqual(len(session["words"]), 6)
                    self.assertEqual(session["words"][0]["stage"], 1)
                    self.assertEqual(len({item["word"] for item in session["words"]}), 6)

                    next_stage_response = client.post(
                        f"/api/test-sessions/{session['session_id']}/next",
                        json={
                            "responses": [
                                {"word": session["words"][0]["word"], "known": True},
                                {"word": session["words"][1]["word"], "known": True},
                                {"word": session["words"][2]["word"], "known": False},
                                {"word": session["words"][3]["word"], "known": False},
                            ],
                            "seed": 23,
                            "stage2_size": 8,
                            "excluded_words": [item["word"] for item in session["words"]],
                        },
                    )
                    self.assertEqual(next_stage_response.status_code, 200)
                    next_stage = next_stage_response.json()
                    self.assertEqual(next_stage["stage"], 2)
                    self.assertEqual(len(next_stage["words"]), 8)
                    self.assertTrue(all(item["stage"] == 2 for item in next_stage["words"]))
                    self.assertTrue(
                        {item["word"] for item in next_stage["words"]}.isdisjoint(
                            {item["word"] for item in session["words"]}
                        )
                    )

                    full_next_stage_response = client.post(
                        f"/api/test-sessions/{session['session_id']}/next",
                        json={
                            "responses": [
                                {"word": item["word"], "known": index < 3}
                                for index, item in enumerate(session["words"])
                            ],
                            "seed": 29,
                            "stage2_size": 110,
                            "excluded_words": [item["word"] for item in session["words"]],
                        },
                    )
                    self.assertEqual(full_next_stage_response.status_code, 200)
                    full_next_stage = full_next_stage_response.json()
                    self.assertEqual(len(full_next_stage["words"]), 110)
                    self.assertTrue(
                        {item["word"] for item in full_next_stage["words"]}.isdisjoint(
                            {item["word"] for item in session["words"]}
                        )
                    )

                    excluded_only_response = client.post(
                        f"/api/test-sessions/{session['session_id']}/next",
                        json={
                            "responses": [
                                {"word": session["words"][0]["word"], "known": True},
                                {"word": session["words"][1]["word"], "known": True},
                                {"word": session["words"][2]["word"], "known": False},
                                {"word": session["words"][3]["word"], "known": False},
                            ],
                            "seed": 31,
                            "stage2_size": 236,
                            "excluded_words": [item["word"] for item in session["words"]],
                        },
                    )
                    self.assertEqual(excluded_only_response.status_code, 200)
                    excluded_only = excluded_only_response.json()
                    self.assertTrue(
                        {item["word"] for item in excluded_only["words"]}.isdisjoint(
                            {item["word"] for item in session["words"]}
                        )
                    )

                    final_response = client.post(
                        f"/api/test-sessions/{session['session_id']}/estimate",
                        json={
                            "responses": [
                                {"word": _word_name(1), "known": True},
                                {"word": _word_name(2), "known": True},
                                {"word": _word_name(8), "known": False},
                                {"word": _word_name(10), "known": False},
                            ]
                        },
                    )
                    self.assertEqual(final_response.status_code, 200)
                    self.assertEqual(final_response.json()["sample_size"], 4)

                    adaptive_response = client.post(
                        "/api/adaptive-test-sessions",
                        json={"seed": 31, "max_items": 6, "min_items": 3, "start_rank": 1000},
                    )
                    self.assertEqual(adaptive_response.status_code, 200)
                    adaptive = adaptive_response.json()
                    self.assertFalse(adaptive["completed"])
                    first_word = adaptive["current_word"]
                    self.assertIsNotNone(first_word)

                    harder_response = client.post(
                        f"/api/adaptive-test-sessions/{adaptive['session_id']}/answer",
                        json={
                            "responses": [{"word": first_word["word"], "status": "known"}],
                            "seed": 31,
                            "max_items": 6,
                            "min_items": 3,
                            "start_rank": 1000,
                        },
                    )
                    self.assertEqual(harder_response.status_code, 200)
                    harder = harder_response.json()
                    self.assertIsNotNone(harder["current_word"])
                    self.assertGreater(harder["current_word"]["rank"], first_word["rank"])

                    complete_response = client.post(
                        f"/api/adaptive-test-sessions/{adaptive['session_id']}/answer",
                        json={
                            "responses": [{"word": first_word["word"], "status": "known"}],
                            "seed": 31,
                            "max_items": 1,
                            "min_items": 1,
                            "start_rank": 1000,
                        },
                    )
                    self.assertEqual(complete_response.status_code, 200)
                    complete = complete_response.json()
                    self.assertTrue(complete["completed"])
                    self.assertIsNotNone(complete["estimate"])

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
                            "responses": [{"word": _word_name(1), "known": True}],
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
                                f"word,status\n{_word_name(1)},known\n{_word_name(2)},known\n{_word_name(3)},unknown\n{_word_name(4)},unknown\n",
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
                            "evaluation_wordlist_path": None,
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
                    text_path.write_text(
                        f"{_word_name(1)} {_word_name(2)} {_word_name(3)} {_word_name(4)}",
                        encoding="utf-8",
                    )
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

                    reports_response = client.get("/api/reports/outputs")
                    self.assertEqual(reports_response.status_code, 200)
                    self.assertIn("text_estimates", reports_response.json())
                    self.assertIn("student_correlation", reports_response.json())


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


def _word_name(index: int) -> str:
    return f"w{chr(97 + (index // 26))}{chr(97 + (index % 26))}"


if __name__ == "__main__":
    unittest.main()
