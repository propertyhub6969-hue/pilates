"""riwayat penyesuaian sisa sesi (session_adjustments)

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = 'a5b6c7d8e9f0'
down_revision = 'f4a5b6c7d8e9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'session_adjustments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('member_package_id', UUID(as_uuid=True), sa.ForeignKey('member_packages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('delta', sa.Integer(), nullable=False),
        sa.Column('before_remaining', sa.Integer(), nullable=True),
        sa.Column('after_remaining', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('adjusted_by_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('adjusted_by_name', sa.String(200), nullable=True),
    )
    op.create_index('ix_session_adjustments_member_package_id', 'session_adjustments', ['member_package_id'])


def downgrade() -> None:
    op.drop_index('ix_session_adjustments_member_package_id', table_name='session_adjustments')
    op.drop_table('session_adjustments')
