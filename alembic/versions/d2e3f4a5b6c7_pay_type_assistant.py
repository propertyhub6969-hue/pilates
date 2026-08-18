"""cara bayar karyawan (pay_type/session_rate) + pendamping sesi (assistant_id)

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects import postgresql


revision = 'd2e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pay_type = postgresql.ENUM('MONTHLY', 'PER_SESSION', name='paytype', create_type=False)
    pay_type.create(op.get_bind(), checkfirst=True)
    op.add_column('employees', sa.Column('pay_type', pay_type, nullable=False, server_default='MONTHLY'))
    op.add_column('employees', sa.Column('session_rate', sa.Numeric(14, 2), nullable=False, server_default='0'))

    op.add_column('class_sessions', sa.Column('assistant_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_class_sessions_assistant', 'class_sessions', 'employees', ['assistant_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_class_sessions_assistant_id', 'class_sessions', ['assistant_id'])


def downgrade() -> None:
    op.drop_index('ix_class_sessions_assistant_id', table_name='class_sessions')
    op.drop_constraint('fk_class_sessions_assistant', 'class_sessions', type_='foreignkey')
    op.drop_column('class_sessions', 'assistant_id')
    op.drop_column('employees', 'session_rate')
    op.drop_column('employees', 'pay_type')
    sa.Enum(name='paytype').drop(op.get_bind(), checkfirst=True)
