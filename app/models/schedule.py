import enum
import uuid
from datetime import date, time
from sqlalchemy import String, Integer, Time, Date, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class SessionCategory(str, enum.Enum):
    UMUM = "umum"        # kelas umum — tampil di dashboard/jadwal member
    PRIVATE = "private"  # private group — TIDAK tampil di aplikasi member (info via WA saja)


class ClassTemplate(BaseModel):
    """
    Template jadwal BERULANG mingguan (mis. "Reformer Basic — Senin 07:00, kapasitas 8").
    Dari template ini sistem meng-generate ClassSession konkret per tanggal.
    """
    __tablename__ = "class_templates"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    instructor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Senin ... 6=Minggu
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=55, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    room: Mapped[str] = mapped_column(String(80), nullable=True)
    category: Mapped[SessionCategory] = mapped_column(
        SAEnum(SessionCategory, name="sessioncategory"), default=SessionCategory.UMUM, nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    instructor: Mapped["User"] = relationship("User", foreign_keys=[instructor_id])


class ClassSessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ClassSession(BaseModel):
    """
    Sesi kelas KONKRET pada tanggal tertentu. Bisa hasil generate dari template
    (template_id terisi) atau kelas sekali-jalan (template_id NULL).
    """
    __tablename__ = "class_sessions"

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    instructor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=55, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    room: Mapped[str] = mapped_column(String(80), nullable=True)

    status: Mapped[ClassSessionStatus] = mapped_column(
        SAEnum(ClassSessionStatus), default=ClassSessionStatus.SCHEDULED, nullable=False, index=True
    )
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[SessionCategory] = mapped_column(
        SAEnum(SessionCategory, name="sessioncategory"), default=SessionCategory.UMUM, nullable=False, index=True
    )
    # Karyawan pendamping (dibayar per sesi) yang hadir mendampingi instruktur di sesi ini
    assistant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )

    instructor: Mapped["User"] = relationship("User", foreign_keys=[instructor_id])
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="session")
