"""kategori pengeluaran dinamis (tabel expense_categories + kolom string)

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-08-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None

_BUILTINS = [
    ('sewa', 'Sewa', 10),
    ('gaji', 'Gaji', 20),
    ('utilitas', 'Utilitas (listrik/air)', 30),
    ('peralatan', 'Peralatan', 40),
    ('perlengkapan', 'Perlengkapan', 50),
    ('marketing', 'Marketing', 60),
    ('kebersihan', 'Kebersihan', 70),
    ('lainnya', 'Lainnya', 999),
]


def upgrade() -> None:
    op.create_table(
        'expense_categories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('key', sa.String(60), nullable=False, unique=True),
        sa.Column('label', sa.String(120), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_builtin', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('100')),
    )
    op.create_index('ix_expense_categories_key', 'expense_categories', ['key'], unique=True)

    for key, label, order in _BUILTINS:
        op.execute(
            "INSERT INTO expense_categories (id, created_at, updated_at, key, label, is_active, is_builtin, sort_order) "
            f"VALUES (gen_random_uuid(), now(), now(), '{key}', '{label}', true, true, {order})"
        )

    # enum → varchar (nilai enum uppercase 'SEWA' → slug 'sewa')
    op.execute("ALTER TABLE expenses ALTER COLUMN category TYPE varchar(60) USING lower(category::text)")
    op.execute("DROP TYPE IF EXISTS expensecategory")


def downgrade() -> None:
    # buat ulang enum & kembalikan kolom (best-effort)
    labels = ",".join(f"'{k.upper()}'" for k, _, _ in _BUILTINS)
    op.execute(f"CREATE TYPE expensecategory AS ENUM ({labels})")
    op.execute("ALTER TABLE expenses ALTER COLUMN category TYPE expensecategory USING upper(category)::expensecategory")
    op.drop_index('ix_expense_categories_key', table_name='expense_categories')
    op.drop_table('expense_categories')
