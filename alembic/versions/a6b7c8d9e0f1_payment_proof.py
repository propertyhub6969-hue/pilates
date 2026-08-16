"""add payments.proof_path (bukti transfer)

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa


revision = 'a6b7c8d9e0f1'
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('payments', sa.Column('proof_path', sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column('payments', 'proof_path')
