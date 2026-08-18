"""transfer antar akun (account_transfers)

Revision ID: f7a8b9c0d1e2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = 'f7a8b9c0d1e2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'account_transfers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('transfer_date', sa.Date(), nullable=False),
        sa.Column('from_account_id', UUID(as_uuid=True), sa.ForeignKey('financial_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('to_account_id', UUID(as_uuid=True), sa.ForeignKey('financial_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_account_transfers_transfer_date', 'account_transfers', ['transfer_date'])
    op.create_index('ix_account_transfers_from_account_id', 'account_transfers', ['from_account_id'])
    op.create_index('ix_account_transfers_to_account_id', 'account_transfers', ['to_account_id'])


def downgrade() -> None:
    op.drop_index('ix_account_transfers_to_account_id', table_name='account_transfers')
    op.drop_index('ix_account_transfers_from_account_id', table_name='account_transfers')
    op.drop_index('ix_account_transfers_transfer_date', table_name='account_transfers')
    op.drop_table('account_transfers')
