"""jendela booking berjenjang + kapasitas di studio_settings

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('studio_settings', sa.Column('bulanan_open_days_before', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('studio_settings', sa.Column('bulanan_open_time', sa.String(5), nullable=False, server_default='20:00'))
    op.add_column('studio_settings', sa.Column('dropin_open_days_before', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('studio_settings', sa.Column('dropin_open_time', sa.String(5), nullable=False, server_default='20:00'))
    op.add_column('studio_settings', sa.Column('booking_close_days_before', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('studio_settings', sa.Column('booking_close_time', sa.String(5), nullable=False, server_default='00:00'))
    op.add_column('studio_settings', sa.Column('default_capacity', sa.Integer(), nullable=False, server_default='14'))
    op.add_column('studio_settings', sa.Column('min_bulanan', sa.Integer(), nullable=False, server_default='10'))


def downgrade() -> None:
    for col in ['min_bulanan', 'default_capacity', 'booking_close_time', 'booking_close_days_before',
                'dropin_open_time', 'dropin_open_days_before', 'bulanan_open_time', 'bulanan_open_days_before']:
        op.drop_column('studio_settings', col)
