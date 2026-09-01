"""account_holder (atas nama rekening bank)

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-08-31

"""
from alembic import op
import sqlalchemy as sa


revision = 'b3c4d5e6f7a8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('financial_accounts', sa.Column('account_holder', sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column('financial_accounts', 'account_holder')
