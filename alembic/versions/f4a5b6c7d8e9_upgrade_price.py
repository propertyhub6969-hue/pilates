"""harga upgrade per paket (packages.upgrade_price)

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-08-21

"""
from alembic import op
import sqlalchemy as sa


revision = 'f4a5b6c7d8e9'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('packages', sa.Column('upgrade_price', sa.Numeric(12, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('packages', 'upgrade_price')
