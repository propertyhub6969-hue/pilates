"""keuangan: financial_accounts + expenses + payments.account_id

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID


revision = 'b7c8d9e0f1a2'
down_revision = 'a6b7c8d9e0f1'
branch_labels = None
depends_on = None

# Label enum = NAMA member (uppercase) sesuai konvensi SQLAlchemy
acct_type = postgresql.ENUM('CASH', 'BANK', name='accounttype', create_type=False)
exp_cat = postgresql.ENUM('SEWA', 'GAJI', 'UTILITAS', 'PERALATAN', 'PERLENGKAPAN', 'MARKETING', 'KEBERSIHAN', 'LAINNYA', name='expensecategory', create_type=False)


def upgrade() -> None:
    acct_type.create(op.get_bind(), checkfirst=True)
    exp_cat.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'financial_accounts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('type', acct_type, nullable=False),
        sa.Column('bank_name', sa.String(80), nullable=True),
        sa.Column('account_number', sa.String(60), nullable=True),
        sa.Column('opening_balance', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'expenses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('category', exp_cat, nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('financial_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_expenses_expense_date', 'expenses', ['expense_date'])
    op.create_index('ix_expenses_category', 'expenses', ['category'])
    op.create_index('ix_expenses_account_id', 'expenses', ['account_id'])

    op.add_column('payments', sa.Column('account_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_payment_account', 'payments', 'financial_accounts', ['account_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_payment_account', 'payments', type_='foreignkey')
    op.drop_column('payments', 'account_id')
    op.drop_table('expenses')
    op.drop_table('financial_accounts')
    acct_type.drop(op.get_bind(), checkfirst=True)
    exp_cat.drop(op.get_bind(), checkfirst=True)
