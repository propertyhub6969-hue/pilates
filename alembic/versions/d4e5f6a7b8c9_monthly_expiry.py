"""paket bulanan: monthly_expiry di packages & member_packages

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('packages', sa.Column('monthly_expiry', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('member_packages', sa.Column('monthly_expiry', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('member_packages', sa.Column('expiry_reminded_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('member_packages', 'expiry_reminded_at')
    op.drop_column('member_packages', 'monthly_expiry')
    op.drop_column('packages', 'monthly_expiry')
