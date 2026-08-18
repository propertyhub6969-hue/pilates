"""penanda reminder H-7 kedaluwarsa (paket panjang)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('member_packages', sa.Column('expiry_reminded_7d_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('member_packages', 'expiry_reminded_7d_at')
