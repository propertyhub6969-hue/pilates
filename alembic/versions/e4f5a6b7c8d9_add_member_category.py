"""add member_category to users

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'e4f5a6b7c8d9'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None

# Simpan NAMA enum (uppercase) sesuai konvensi SQLAlchemy — samakan dgn userrole
membercat = postgresql.ENUM('BULANAN', 'PRIVATE', 'PER_DATANG', name='membercategory', create_type=False)


def upgrade() -> None:
    membercat.create(op.get_bind(), checkfirst=True)
    op.add_column('users', sa.Column('member_category', membercat, nullable=True))
    op.create_index('ix_users_member_category', 'users', ['member_category'])


def downgrade() -> None:
    op.drop_index('ix_users_member_category', 'users')
    op.drop_column('users', 'member_category')
    membercat.drop(op.get_bind(), checkfirst=True)
