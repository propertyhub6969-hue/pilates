"""batas bawah tanggal jadwal member (studio_settings.member_schedule_start)

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa


revision = 'd8e9f0a1b2c3'
down_revision = 'c7d8e9f0a1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('studio_settings', sa.Column('member_schedule_start', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('studio_settings', 'member_schedule_start')
