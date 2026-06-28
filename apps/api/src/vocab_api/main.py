from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path
import csv
import json

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlmodel import Session
from vocab_estimator.models import AdaptiveState
from vocab_experiments.stability import run_stability_experiment
from vocab_experiments.text_estimate import estimate_text_files

from .database import create_db_and_tables, get_session
from .repositories import create_batch_job, create_student_result, list_student_results
from .schemas import (
    AdaptiveAnswerRequest,
    AdaptiveSessionOut,
    AdaptiveTestSessionRequest,
    BatchJobOut,
    EstimateRequest,
    EstimateResultOut,
    FinalEstimateRequest,
    HealthOut,
    NextStageRequest,
    ReportOutputsOut,
    StabilityExperimentOut,
    StabilityExperimentRequest,
    StudentResultCreate,
    StudentResultOut,
    TextEstimateOut,
    TextEstimateRequest,
    TextEstimateRow,
    TestSessionOut,
    TestSessionRequest,
    TestWordOut,
)
from .services import (
    estimate_from_csv_text,
    estimate_from_inputs,
    generate_adaptive_session,
    generate_first_stage,
    generate_next_stage,
    load_default_word_ranks,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    load_default_word_ranks()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="vocab-estimator", lifespan=lifespan)

    @app.get("/api/health", response_model=HealthOut)
    def health() -> HealthOut:
        return HealthOut(status="ok")

    @app.post("/api/estimate", response_model=EstimateResultOut)
    def estimate(payload: EstimateRequest) -> EstimateResultOut:
        result = estimate_from_inputs([(item.word, item.known) for item in payload.responses])
        return EstimateResultOut(
            estimate=result.estimate,
            range_low=result.range_low,
            range_high=result.range_high,
            confidence=result.confidence,
            method=result.method,
            sample_size=result.sample_size,
            ignored_words=result.ignored_words,
        )

    @app.post("/api/test-sessions", response_model=TestSessionOut)
    def create_test_session(payload: TestSessionRequest) -> TestSessionOut:
        seed = payload.seed if payload.seed is not None else 2026
        words = generate_first_stage(seed, payload.stage1_size)
        return TestSessionOut(
            session_id=f"session-{seed}-{payload.stage1_size}",
            stage=1,
            words=[TestWordOut(word=word.word, rank=word.rank, stage=word.stage) for word in words],
        )

    @app.post("/api/test-sessions/{session_id}/next", response_model=TestSessionOut)
    def create_next_test_stage(session_id: str, payload: NextStageRequest) -> TestSessionOut:
        seed = payload.seed if payload.seed is not None else _session_seed(session_id, 2)
        words = generate_next_stage(
            [(item.word, item.known) for item in payload.responses],
            seed,
            payload.stage2_size,
            payload.excluded_words,
        )
        return TestSessionOut(
            session_id=session_id,
            stage=2,
            words=[TestWordOut(word=word.word, rank=word.rank, stage=word.stage) for word in words],
        )

    @app.post("/api/test-sessions/{session_id}/estimate", response_model=EstimateResultOut)
    def estimate_test_session(session_id: str, payload: FinalEstimateRequest) -> EstimateResultOut:
        result = estimate_from_inputs([(item.word, item.known) for item in payload.responses])
        return EstimateResultOut(
            estimate=result.estimate,
            range_low=result.range_low,
            range_high=result.range_high,
            confidence=result.confidence,
            method=result.method,
            sample_size=result.sample_size,
            ignored_words=result.ignored_words,
        )

    @app.post("/api/adaptive-test-sessions", response_model=AdaptiveSessionOut)
    def create_adaptive_test_session(payload: AdaptiveTestSessionRequest) -> AdaptiveSessionOut:
        seed = payload.seed if payload.seed is not None else 2026
        state = generate_adaptive_session(
            [],
            seed=seed,
            max_items=payload.max_items,
            min_items=payload.min_items,
            start_rank=payload.start_rank,
        )
        return _adaptive_state_out(f"adaptive-{seed}-{payload.max_items}", state)

    @app.post("/api/adaptive-test-sessions/{session_id}/answer", response_model=AdaptiveSessionOut)
    def answer_adaptive_test_session(session_id: str, payload: AdaptiveAnswerRequest) -> AdaptiveSessionOut:
        seed = payload.seed if payload.seed is not None else _session_seed(session_id, 3)
        try:
            state = generate_adaptive_session(
                [(item.word, item.status) for item in payload.responses],
                seed=seed,
                max_items=payload.max_items,
                min_items=payload.min_items,
                start_rank=payload.start_rank,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return _adaptive_state_out(session_id, state)

    @app.post("/api/batch", response_model=BatchJobOut)
    async def batch_estimate(
        file: UploadFile = File(...),
        session: Session = Depends(get_session),
    ) -> BatchJobOut:
        try:
            content = (await file.read()).decode("utf-8-sig")
            result, row_count = estimate_from_csv_text(content)
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        record = create_batch_job(
            session,
            filename=file.filename or "responses.csv",
            result=result,
            row_count=row_count,
        )
        return BatchJobOut.model_validate(record, from_attributes=True)

    @app.post("/api/student-results", response_model=StudentResultOut)
    def create_student_result_route(
        payload: StudentResultCreate,
        session: Session = Depends(get_session),
    ) -> StudentResultOut:
        record = create_student_result(session, payload)
        return StudentResultOut.model_validate(record, from_attributes=True)

    @app.get("/api/student-results", response_model=list[StudentResultOut])
    def list_student_results_route(session: Session = Depends(get_session)) -> list[StudentResultOut]:
        return [
            StudentResultOut.model_validate(record, from_attributes=True)
            for record in list_student_results(session)
        ]

    @app.post("/api/experiments/stability", response_model=StabilityExperimentOut)
    def run_stability_experiment_route(payload: StabilityExperimentRequest) -> StabilityExperimentOut:
        rows_written = run_stability_experiment(
            get_settings_word_rank_path(),
            payload.output_path,
            evaluation_wordlist_csv=_existing_path_or_none(payload.evaluation_wordlist_path),
            unknown_ratios=payload.unknown_ratios,
            sample_lengths=payload.sample_lengths,
            repeats=payload.repeats,
            bootstrap_iterations=payload.bootstrap_iterations,
        )
        return StabilityExperimentOut(output_path=payload.output_path, rows_written=rows_written)

    @app.post("/api/experiments/text-estimate", response_model=TextEstimateOut)
    def run_text_estimate_route(payload: TextEstimateRequest) -> TextEstimateOut:
        results = estimate_text_files(payload.text_paths, get_settings_word_rank_path(), payload.output_path)
        return TextEstimateOut(
            output_path=payload.output_path,
            results=[
                TextEstimateRow(
                    text_path=result.text_path,
                    estimate=result.estimate,
                    range_low=result.range_low,
                    range_high=result.range_high,
                    confidence=result.confidence,
                    method=result.method,
                    unique_words=result.unique_words,
                    matched_words=result.matched_words,
                    ignored_words=result.ignored_words,
                )
                for result in results
            ],
        )

    @app.get("/api/reports/outputs", response_model=ReportOutputsOut)
    def read_report_outputs() -> ReportOutputsOut:
        return ReportOutputsOut(
            text_estimates=_read_report_csv("reports/outputs/text_estimates.csv"),
            learner_profiles=_read_report_csv("reports/outputs/learner_profiles.csv"),
            stability_summary=_read_report_csv("reports/outputs/stability_summary.csv"),
            student_summary=_read_report_csv("reports/outputs/student_summary.csv"),
            student_correlation=_read_report_json("reports/outputs/student_correlation.json"),
        )

    return app


app = create_app()


def get_settings_word_rank_path() -> str:
    from .config import get_settings

    return str(get_settings().word_rank_path)


def _session_seed(session_id: str, stage: int) -> int:
    return sum(ord(char) for char in session_id) + stage * 1009


def _adaptive_state_out(session_id: str, adaptive_state: AdaptiveState) -> AdaptiveSessionOut:
    current_word = adaptive_state.current_word
    estimate = adaptive_state.estimate
    return AdaptiveSessionOut(
        session_id=session_id,
        current_word=(
            TestWordOut(word=current_word.word, rank=current_word.rank, stage=current_word.stage)
            if current_word is not None
            else None
        ),
        completed=adaptive_state.completed,
        estimate=(
            EstimateResultOut(
                estimate=estimate.estimate,
                range_low=estimate.range_low,
                range_high=estimate.range_high,
                confidence=estimate.confidence,
                method=estimate.method,
                sample_size=estimate.sample_size,
                ignored_words=estimate.ignored_words,
            )
            if estimate is not None
            else None
        ),
        progress=adaptive_state.progress,
        answered_count=adaptive_state.answered_count,
        max_items=adaptive_state.max_items,
        target_rank=adaptive_state.target_rank,
    )


def _existing_path_or_none(path: str | None) -> str | None:
    if path is None:
        return None
    return path if Path(path).exists() else None


def _read_report_csv(path: str) -> list[dict[str, str]]:
    report_path = Path(path)
    if not report_path.exists():
        return []
    with report_path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _read_report_json(path: str) -> dict[str, object]:
    report_path = Path(path)
    if not report_path.exists():
        return {}
    with report_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, dict) else {}
