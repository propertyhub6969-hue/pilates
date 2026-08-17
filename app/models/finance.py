import enum
import uuid
from datetime import date
from sqlalchemy import String, Numeric, Boolean, Text, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


CATEGORY_LABEL = {
    "sewa": "Sewa", "gaji": "Gaji", "utilitas": "Utilitas (listrik/air)",
    "peralatan": "Peralatan", "perlengkapan": "Perlengkapan", "marketing": "Marketing",
    "kebersihan": "Kebersihan", "lainnya": "Lainnya",
}


class AccountType(str, enum.Enum):
    CASH = "cash"   # Kas / tunai
    BANK = "bank"   # Rekening bank


class FinancialAccount(BaseModel):
    """Akun kas atau rekening bank untuk melacak uang masuk/keluar & saldo."""
    __tablename__ = "financial_accounts"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[AccountType] = mapped_column(SAEnum(AccountType, name="accounttype"), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(80), nullable=True)       # utk bank
    account_number: Mapped[str] = mapped_column(String(60), nullable=True)  # no rekening
    opening_balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ExpenseCategory(str, enum.Enum):
    SEWA = "sewa"
    GAJI = "gaji"                 # gaji/honor instruktur & staf
    UTILITAS = "utilitas"        # listrik, air, internet
    PERALATAN = "peralatan"      # reformer, alat
    PERLENGKAPAN = "perlengkapan"  # matras, handuk, dll
    MARKETING = "marketing"
    KEBERSIHAN = "kebersihan"
    LAINNYA = "lainnya"


class Expense(BaseModel):
    """Pengeluaran operasional studio (uang keluar dari sebuah akun)."""
    __tablename__ = "expenses"

    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[ExpenseCategory] = mapped_column(SAEnum(ExpenseCategory, name="expensecategory"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("financial_accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=True)
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class ExpenseEdit(BaseModel):
    """Riwayat perubahan sebuah pengeluaran — siapa mengubah apa & kapan."""
    __tablename__ = "expense_edits"

    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    edited_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    edited_by_name: Mapped[str] = mapped_column(String(200), nullable=True)  # denormalisasi agar riwayat tetap utuh
    summary: Mapped[str] = mapped_column(Text, nullable=True)  # ringkasan perubahan (sebelum → sesudah)
