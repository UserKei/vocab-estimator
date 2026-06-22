from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from vocab_experiments.batch import run_batch
from vocab_experiments.report_summary import summarize_stability
from vocab_experiments.stability import run_stability_experiment
from vocab_experiments.text_estimate import estimate_text_file, estimate_text_files
from vocab_experiments.word_rank import build_word_rank


class ExperimentsToolsTests(unittest.TestCase):
    def test_build_word_rank_creates_ranked_csv_from_word_list(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "words.txt"
            output = Path(tmp) / "word_rank.csv"
            source.write_text("the\nApple\napple\nrare-word\n", encoding="utf-8")

            count = build_word_rank(source, output, source_name="fixture")

            self.assertEqual(count, 3)
            with output.open("r", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual([row["word"] for row in rows], ["the", "apple", "rare"])
            self.assertEqual([row["rank"] for row in rows], ["1", "2", "3"])
            self.assertEqual(rows[0]["source"], "fixture")

    def test_run_batch_reads_responses_and_writes_single_result_row(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            word_rank = tmp_path / "word_rank.csv"
            responses = tmp_path / "responses.csv"
            output = tmp_path / "result.csv"
            word_rank.write_text(
                "word,rank,frequency,source\n"
                "alpha,100,0.0,fixture\n"
                "bravo,200,0.0,fixture\n"
                "charlie,300,0.0,fixture\n"
                "delta,400,0.0,fixture\n",
                encoding="utf-8",
            )
            responses.write_text(
                "word,status\n"
                "alpha,known\n"
                "bravo,known\n"
                "charlie,unknown\n"
                "delta,unknown\n",
                encoding="utf-8",
            )

            result = run_batch(responses, word_rank, output_csv=output, bootstrap_iterations=0)

            self.assertEqual(result.estimate, 200)
            with output.open("r", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["estimate"], "200")
            self.assertEqual(rows[0]["method"], "rank_midpoint_bootstrap_v1")

    def test_run_stability_experiment_writes_rows_for_each_combination(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            word_rank = tmp_path / "word_rank.csv"
            output = tmp_path / "stability.csv"
            fixture_words = [
                "alpha",
                "bravo",
                "charlie",
                "delta",
                "echo",
                "foxtrot",
                "golf",
                "hotel",
                "india",
                "juliet",
                "kilo",
                "lima",
                "mike",
                "november",
                "oscar",
                "papa",
                "quebec",
                "romeo",
                "sierra",
                "tango",
            ]
            with word_rank.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["word", "rank", "frequency", "source"])
                for index, word in enumerate(fixture_words, start=1):
                    writer.writerow([word, index, "0.0", "fixture"])

            rows_written = run_stability_experiment(
                word_rank,
                output,
                unknown_ratios=[0.1, 0.2],
                sample_lengths=[5],
                repeats=3,
                seed=1,
            )

            self.assertEqual(rows_written, 6)
            with output.open("r", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), 6)
            self.assertEqual(set(rows[0]), {
                "unknown_ratio",
                "sample_length",
                "repeat",
                "estimate",
                "range_low",
                "range_high",
                "confidence",
                "sample_size",
            })

    def test_estimate_text_file_outputs_rank_range_from_document_words(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            word_rank = tmp_path / "word_rank.csv"
            text = tmp_path / "sample.txt"
            output = tmp_path / "text_estimates.csv"
            word_rank.write_text(
                "word,rank,frequency,source\n"
                "apple,100,0.0,fixture\n"
                "banana,200,0.0,fixture\n"
                "charlie,300,0.0,fixture\n"
                "delta,400,0.0,fixture\n"
                "exemplify,1000,0.0,fixture\n",
                encoding="utf-8",
            )
            text.write_text("Apple banana charlie delta exemplify unknownword.", encoding="utf-8")

            result = estimate_text_file(text, word_rank, output_csv=output)

            self.assertEqual(result.estimate, 1000)
            self.assertEqual(result.range_low, 400)
            self.assertEqual(result.range_high, 1000)
            self.assertEqual(result.unique_words, 6)
            self.assertEqual(result.matched_words, 5)
            self.assertEqual(result.ignored_words, ["unknownword"])
            with output.open("r", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(rows[0]["method"], "text_rank_percentile_v1")

    def test_estimate_text_files_writes_multiple_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            word_rank = tmp_path / "word_rank.csv"
            first = tmp_path / "first.txt"
            second = tmp_path / "second.txt"
            output = tmp_path / "text_estimates.csv"
            word_rank.write_text(
                "word,rank,frequency,source\n"
                "easy,10,0.0,fixture\n"
                "hard,900,0.0,fixture\n",
                encoding="utf-8",
            )
            first.write_text("easy easy", encoding="utf-8")
            second.write_text("easy hard", encoding="utf-8")

            results = estimate_text_files([first, second], word_rank, output)

            self.assertEqual([result.estimate for result in results], [10, 900])
            with output.open("r", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), 2)

    def test_summarize_stability_writes_report_csv_json_and_svg(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            stability = tmp_path / "stability.csv"
            summary_csv = tmp_path / "stability_summary.csv"
            summary_json = tmp_path / "stability_summary.json"
            chart_svg = tmp_path / "stability_chart.svg"
            stability.write_text(
                "unknown_ratio,sample_length,repeat,estimate,range_low,range_high,confidence,sample_size\n"
                "0.1,200,1,9000,8500,9500,0.9,200\n"
                "0.1,200,2,8800,8300,9300,0.8,200\n"
                "0.2,200,1,7600,7000,8200,0.7,200\n",
                encoding="utf-8",
            )

            rows = summarize_stability(stability, summary_csv, summary_json, chart_svg)

            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0].unknown_ratio, 0.1)
            self.assertEqual(rows[0].sample_length, 200)
            self.assertEqual(rows[0].runs, 2)
            self.assertEqual(rows[0].estimate_mean, 8900)
            self.assertEqual(rows[0].confidence_mean, 0.85)
            with summary_csv.open("r", encoding="utf-8") as handle:
                csv_rows = list(csv.DictReader(handle))
            self.assertEqual(csv_rows[0]["estimate_mean"], "8900")
            self.assertIn('"unknown_ratio": 0.1', summary_json.read_text(encoding="utf-8"))
            self.assertTrue(chart_svg.read_text(encoding="utf-8").startswith("<svg"))


if __name__ == "__main__":
    unittest.main()
