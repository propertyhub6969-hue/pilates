"""add expense_edits (riwayat edit pengeluaran)

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-08-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = 'd9e0f1a2b3c4'
down_revision = 'c8d9e0f1a2b3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'expense_edits',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expense_id', UUID(as_uuid=True), sa.ForeignKey('expenses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('edited_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('edited_by_name', sa.String(200), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
    )
    op.create_index('ix_expense_edits_expense_id', 'expense_edits', ['expense_id'])


def downgrade() -> None:
    op.drop_index('ix_expense_edits_expense_id', table_name='expense_edits')
    op.drop_table('expense_edits')
