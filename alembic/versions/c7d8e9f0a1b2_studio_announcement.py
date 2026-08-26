"""pengumuman member (studio_settings.announcement)

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa


revision = 'c7d8e9f0a1b2'
down_revision = 'b6c7d8e9f0a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('studio_settings', sa.Column('announcement', sa.Text(), nullable=True))
    op.add_column('studio_settings', sa.Column('announcement_active', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('studio_settings', 'announcement_active')
    op.drop_column('studio_settings', 'announcement')
