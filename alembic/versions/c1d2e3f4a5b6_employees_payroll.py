"""karyawan & payroll (employees, payroll_entries)

Revision ID: c1d2e3f4a5b6
Revises: f7a8b9c0d1e2
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects import postgresql


revision = 'c1d2e3f4a5b6'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'employees',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('position', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(30), nullable=True),
        sa.Column('base_salary', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('join_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
    )

    payroll_status = postgresql.ENUM('DRAFT', 'PAID', name='payrollstatus', create_type=False)
    payroll_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'payroll_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('employee_id', UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employee_name', sa.String(150), nullable=False),
        sa.Column('period', sa.String(7), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('status', payroll_status, nullable=False, server_default='DRAFT'),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('financial_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('expense_id', UUID(as_uuid=True), sa.ForeignKey('expenses.id', ondelete='SET NULL'), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_payroll_entries_employee_id', 'payroll_entries', ['employee_id'])
    op.create_index('ix_payroll_entries_period', 'payroll_entries', ['period'])
    op.create_index('ix_payroll_entries_status', 'payroll_entries', ['status'])


def downgrade() -> None:
    op.drop_table('payroll_entries')
    sa.Enum(name='payrollstatus').drop(op.get_bind(), checkfirst=True)
    op.drop_table('employees')
