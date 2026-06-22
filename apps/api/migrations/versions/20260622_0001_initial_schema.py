"""initial schema

Revision ID: 20260622_0001
Revises:
Create Date: 2026-06-22 00:00:00
"""

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision = "20260622_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "batch_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("estimate", sa.Integer(), nullable=False),
        sa.Column("range_low", sa.Integer(), nullable=False),
        sa.Column("range_high", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("ignored_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "student_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_code", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("cet4_score", sa.Integer(), nullable=True),
        sa.Column("cet6_score", sa.Integer(), nullable=True),
        sa.Column("estimate", sa.Integer(), nullable=False),
        sa.Column("range_low", sa.Integer(), nullable=False),
        sa.Column("range_high", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("method", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_student_results_student_code", "student_results", ["student_code"])
    op.create_table(
        "estimate_responses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_result_id", sa.Integer(), nullable=False),
        sa.Column("word", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("known", sa.Boolean(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["student_result_id"], ["student_results.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_estimate_responses_student_result_id",
        "estimate_responses",
        ["student_result_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_estimate_responses_student_result_id", table_name="estimate_responses")
    op.drop_table("estimate_responses")
    op.drop_index("ix_student_results_student_code", table_name="student_results")
    op.drop_table("student_results")
    op.drop_table("batch_jobs")

