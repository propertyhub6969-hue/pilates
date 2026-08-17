"""add users.avatar_path (foto profil)

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
Create Date: 2026-08-17

"""
from alembic import op
import sqlalchemy as sa


revision = 'e0f1a2b3c4d5'
down_revision = 'd9e0f1a2b3c4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('avatar_path', sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar_path')
