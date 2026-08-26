"""kategori sesi (umum/private) di templates & sessions

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'b6c7d8e9f0a1'
down_revision = 'a5b6c7d8e9f0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    cat = postgresql.ENUM('UMUM', 'PRIVATE', name='sessioncategory', create_type=False)
    cat.create(op.get_bind(), checkfirst=True)
    op.add_column('class_templates', sa.Column('category', cat, nullable=False, server_default='UMUM'))
    op.add_column('class_sessions', sa.Column('category', cat, nullable=False, server_default='UMUM'))
    op.create_index('ix_class_sessions_category', 'class_sessions', ['category'])


def downgrade() -> None:
    op.drop_index('ix_class_sessions_category', table_name='class_sessions')
    op.drop_column('class_sessions', 'category')
    op.drop_column('class_templates', 'category')
    sa.Enum(name='sessioncategory').drop(op.get_bind(), checkfirst=True)
