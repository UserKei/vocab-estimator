from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from sqlmodel import Session
from vocab_experiments.stability import run_stability_experiment
from vocab_experiments.text_estimate import estimate_text_files

from .database import create_db_and_tables, get_session
from .repositories import create_batch_job, create_student_result, list_student_results
from .schemas import (
    BatchJobOut,
    EstimateRequest,
    EstimateResultOut,
    HealthOut,
    StabilityExperimentOut,
    StabilityExperimentRequest,
    StudentResultCreate,
    StudentResultOut,
    TextEstimateOut,
    TextEstimateRequest,
    TextEstimateRow,
)
from .services import estimate_from_csv_text, estimate_from_inputs, load_default_word_ranks


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
            unknown_ratios=payload.unknown_ratios,
            sample_lengths=payload.sample_lengths,
            repeats=payload.repeats,
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

    return app


app = create_app()


def get_settings_word_rank_path() -> str:
    from .config import get_settings

    return str(get_settings().word_rank_path)
