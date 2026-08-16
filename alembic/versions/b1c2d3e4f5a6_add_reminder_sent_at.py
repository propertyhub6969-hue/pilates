"""add reminder_sent_at to bookings

Revision ID: b1c2d3e4f5a6
Revises: a74ab613c0c4
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa


revision = 'b1c2d3e4f5a6'
down_revision = 'a74ab613c0c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('reminder_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'reminder_sent_at')
