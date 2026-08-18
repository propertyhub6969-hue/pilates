"""nomor kuitansi berurutan di payments (receipt_no)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa


revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq")
    op.add_column('payments', sa.Column('receipt_no', sa.BigInteger(), nullable=True))
    # Backfill nomor berurutan berdasarkan waktu buat
    op.execute("""
        UPDATE payments p SET receipt_no = s.rn
        FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM payments) s
        WHERE p.id = s.id
    """)
    # Lanjutkan sequence dari nomor terakhir
    op.execute("SELECT setval('payment_receipt_seq', COALESCE((SELECT MAX(receipt_no) FROM payments), 0) + 1, false)")
    op.execute("ALTER TABLE payments ALTER COLUMN receipt_no SET DEFAULT nextval('payment_receipt_seq')")
    op.create_unique_constraint('uq_payments_receipt_no', 'payments', ['receipt_no'])


def downgrade() -> None:
    op.drop_constraint('uq_payments_receipt_no', 'payments', type_='unique')
    op.drop_column('payments', 'receipt_no')
    op.execute("DROP SEQUENCE IF EXISTS payment_receipt_seq")
