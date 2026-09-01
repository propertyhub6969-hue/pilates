import uuid
from datetime import date
from sqlalchemy import String, Text, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class AttendanceEntry(BaseModel):
    """Entry riwayat kelas MANUAL (dicatat admin) — murni catatan, TIDAK mengubah kuota.
    Riwayat kehadiran member = gabungan booking ATTENDED/NO_SHOW/lewat (otomatis) + entry ini."""
    __tablename__ = "attendance_entries"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_name: Mapped[str] = mapped_column(String(200), nullable=True)  # denormalisasi
