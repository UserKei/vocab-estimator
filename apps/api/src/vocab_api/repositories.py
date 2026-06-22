from __future__ import annotations

from sqlmodel import Session, select

from .models import EstimateResponse, StudentResult
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

