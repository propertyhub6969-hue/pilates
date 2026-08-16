"""add branches + branch_id on templates/sessions (backfill default)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None

DEFAULT_BRANCH_ID = 'a0000000-0000-0000-0000-000000000001'


def upgrade() -> None:
    op.create_table(
        'branches',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(30), nullable=True),
        sa.Column('cancellation_window_hours', sa.Integer(), nullable=False, server_default='12'),
        sa.Column('booking_lead_close_hours', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Kolom branch_id (nullable dulu utk backfill)
    op.add_column('class_templates', sa.Column('branch_id', UUID(as_uuid=True), nullable=True))
    op.add_column('class_sessions', sa.Column('branch_id', UUID(as_uuid=True), nullable=True))

    # Cabang default: ambil identitas dari studio_settings bila ada
    op.execute(f"""
        INSERT INTO branches (id, name, address, phone, cancellation_window_hours, booking_lead_close_hours, is_active, is_default, created_at, updated_at)
        SELECT '{DEFAULT_BRANCH_ID}',
               COALESCE(NULLIF(s.name, ''), 'Cabang Utama'),
               s.address, s.phone,
               COALESCE(s.cancellation_window_hours, 12),
               COALESCE(s.booking_lead_close_hours, 0),
               true, true, now(), now()
        FROM studio_settings s
        LIMIT 1
    """)
    # Fallback bila studio_settings kosong
    op.execute(f"""
        INSERT INTO branches (id, name, cancellation_window_hours, booking_lead_close_hours, is_active, is_default, created_at, updated_at)
        SELECT '{DEFAULT_BRANCH_ID}', 'Cabang Utama', 12, 0, true, true, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM branches)
    """)

    # Backfill jadwal lama ke cabang default
    op.execute(f"UPDATE class_templates SET branch_id = '{DEFAULT_BRANCH_ID}' WHERE branch_id IS NULL")
    op.execute(f"UPDATE class_sessions SET branch_id = '{DEFAULT_BRANCH_ID}' WHERE branch_id IS NULL")

    # FK + NOT NULL + index
    op.create_foreign_key('fk_template_branch', 'class_templates', 'branches', ['branch_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_session_branch', 'class_sessions', 'branches', ['branch_id'], ['id'], ondelete='CASCADE')
    op.alter_column('class_templates', 'branch_id', nullable=False)
    op.alter_column('class_sessions', 'branch_id', nullable=False)
    op.create_index('ix_class_templates_branch_id', 'class_templates', ['branch_id'])
    op.create_index('ix_class_sessions_branch_id', 'class_sessions', ['branch_id'])


def downgrade() -> None:
    op.drop_index('ix_class_sessions_branch_id', 'class_sessions')
    op.drop_index('ix_class_templates_branch_id', 'class_templates')
    op.drop_constraint('fk_session_branch', 'class_sessions', type_='foreignkey')
    op.drop_constraint('fk_template_branch', 'class_templates', type_='foreignkey')
    op.drop_column('class_sessions', 'branch_id')
    op.drop_column('class_templates', 'branch_id')
    op.drop_table('branches')
