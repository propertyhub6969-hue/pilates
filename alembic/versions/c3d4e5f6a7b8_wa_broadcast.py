"""broadcast jadwal via WhatsApp (grup bulanan + toggle + link)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('studio_settings', sa.Column('wa_broadcast_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('studio_settings', sa.Column('wa_group_bulanan', sa.String(120), nullable=True))
    op.add_column('studio_settings', sa.Column('booking_url', sa.String(200), nullable=False, server_default='https://reformeryourbody.com/jadwal'))


def downgrade() -> None:
    op.drop_column('studio_settings', 'booking_url')
    op.drop_column('studio_settings', 'wa_group_bulanan')
    op.drop_column('studio_settings', 'wa_broadcast_enabled')
