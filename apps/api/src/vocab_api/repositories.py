from __future__ import annotations

from sqlmodel import Session, select

from vocab_estimator.models import EstimateResult

from .models import BatchJob, EstimateResponse, StudentResult
from .schemas import StudentResultCreate


def create_student_result(session: Session, payload: StudentResultCreate) -> StudentResult:
    record = StudentResult(
        student_code=payload.student_code,
        cet4_score=payload.cet4_score,
        cet6_score=payload.cet6_score,
        estimate=payload.estimate,
        range_low=payload.range_low,
        range_high=payload.range_high,
        confidence=payload.confidence,
        method=payload.method,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    for response in payload.responses:
        session.add(
            EstimateResponse(
                student_result_id=record.id or 0,
                word=response.word,
                known=response.known,
            )
        )
    session.commit()
    session.refresh(record)
    return record


def list_student_results(session: Session) -> list[StudentResult]:
    statement = select(StudentResult).order_by(StudentResult.created_at.desc())
    return list(session.exec(statement).all())


def create_batch_job(
    session: Session,
    *,
    filename: str,
    result: EstimateResult,
    row_count: int,
) -> BatchJob:
    record = BatchJob(
        filename=filename,
        estimate=result.estimate,
        range_low=result.range_low,
        range_high=result.range_high,
        confidence=result.confidence,
        row_count=row_count,
        ignored_count=len(result.ignored_words),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record
