"""drop-in: studio_settings.drop_in_price + payments.booking_id

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = 'f5a6b7c8d9e0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('studio_settings', sa.Column('drop_in_price', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('payments', sa.Column('booking_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_payment_booking', 'payments', 'bookings', ['booking_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_payment_booking', 'payments', type_='foreignkey')
    op.drop_column('payments', 'booking_id')
    op.drop_column('studio_settings', 'drop_in_price')
