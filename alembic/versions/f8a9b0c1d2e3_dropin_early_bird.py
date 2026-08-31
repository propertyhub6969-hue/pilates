"""early-bird drop-in price (studio_settings)

Revision ID: f8a9b0c1d2e3
Revises: f0a1b2c3d4e5
Create Date: 2026-08-31

"""
from alembic import op
import sqlalchemy as sa


revision = 'f8a9b0c1d2e3'
down_revision = 'f0a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('studio_settings', sa.Column('dropin_early_bird_price', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('studio_settings', sa.Column('dropin_early_bird_hours', sa.Integer(), nullable=False, server_default='12'))


def downgrade() -> None:
    op.drop_column('studio_settings', 'dropin_early_bird_hours')
    op.drop_column('studio_settings', 'dropin_early_bird_price')
