import enum
import uuid
from datetime import date
from sqlalchemy import String, Numeric, Boolean, Text, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class PayType(str, enum.Enum):
    MONTHLY = "monthly"          # gaji pokok bulanan tetap
    PER_SESSION = "per_session"  # dibayar per sesi hadir (mis. pendamping instruktur)


class Employee(BaseModel):
    """Karyawan studio (entitas HR). Bisa TANPA akun aplikasi (mis. kebersihan/resepsionis),
    atau ditautkan ke akun User (instruktur/admin) lewat user_id."""
    __tablename__ = "employees"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    position: Mapped[str] = mapped_column(String(100), nullable=True)     # jabatan
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    pay_type: Mapped[PayType] = mapped_column(
        SAEnum(PayType), default=PayType.MONTHLY, nullable=False
    )
    base_salary: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)  # gaji pokok bulanan (MONTHLY)
    session_rate: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)  # tarif per sesi (PER_SESSION)
    join_date: Mapped[date] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str] = mapped_column(Text, nullable=True)


class PayrollStatus(str, enum.Enum):
    DRAFT = "draft"   # belum dibayar
    PAID = "paid"     # sudah dibayar → tercatat sbg Pengeluaran (gaji)


class PayrollEntry(BaseModel):
    """Satu baris gaji seorang karyawan untuk satu periode (bulan). Saat DIBAYAR,
    otomatis membuat Expense kategori 'gaji' (expense_id) agar masuk laba/rugi & buku besar."""
    __tablename__ = "payroll_entries"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_name: Mapped[str] = mapped_column(String(150), nullable=False)  # snapshot
    period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)  # 'YYYY-MM'
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    status: Mapped[PayrollStatus] = mapped_column(
        SAEnum(PayrollStatus), default=PayrollStatus.DRAFT, nullable=False, index=True
    )
    paid_date: Mapped[date] = mapped_column(Date, nullable=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("financial_accounts.id", ondelete="SET NULL"), nullable=True
    )
    expense_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str] = mapped_column(Text, nullable=True)
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
