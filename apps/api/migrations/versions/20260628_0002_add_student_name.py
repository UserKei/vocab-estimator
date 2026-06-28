"""add student name

Revision ID: 20260628_0002
Revises: 20260622_0001
Create Date: 2026-06-28 00:00:00
"""

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision = "20260628_0002"
down_revision = "20260622_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "student_results",
        sa.Column(
            "student_name",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="",
        ),
    )
    op.alter_column("student_results", "student_name", server_default=None)


def downgrade() -> None:
    op.drop_column("student_results", "student_name")
