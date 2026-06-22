from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI
from sqlmodel import Session

from .database import create_db_and_tables, get_session
from .repositories import create_student_result, list_student_results
from .schemas import (
    EstimateRequest,
    EstimateResultOut,
    HealthOut,
    StudentResultCreate,
    StudentResultOut,
)
from .services import estimate_from_inputs, load_default_word_ranks


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

    return app


app = create_app()

