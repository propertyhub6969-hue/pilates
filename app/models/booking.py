import enum
import uuid
from datetime import datetime
from sqlalchemy import Integer, ForeignKey, DateTime, Text, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class BookingStatus(str, enum.Enum):
    BOOKED = "booked"        # slot terpesan, kuota ditahan (hold)
    WAITLIST = "waitlist"    # kelas penuh, antre
    ATTENDED = "attended"    # hadir & check-in → kuota terpakai
    CANCELLED = "cancelled"  # batal tepat waktu → kuota dikembalikan
    NO_SHOW = "no_show"      # tidak hadir / batal terlambat → kuota hangus


class Booking(BaseModel):
    """
    Pemesanan slot oleh seorang member pada sebuah ClassSession.
    Alur kuota: booking menahan 1 kuota dari MemberPackage; check-in mengonsumsinya;
    batal tepat waktu mengembalikannya; no-show/batal terlambat menghanguskannya.
    """
    __tablename__ = "bookings"
    __table_args__ = (
        # Satu member tak bisa punya 2 booking aktif di sesi yang sama.
        UniqueConstraint("session_id", "member_id", name="uq_booking_session_member"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # MemberPackage yang kuotanya dipakai untuk booking ini.
    member_package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("member_packages.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[BookingStatus] = mapped_column(
        SAEnum(BookingStatus), default=BookingStatus.BOOKED, nullable=False, index=True
    )
    # Urutan antre (hanya relevan saat status=waitlist)
    waitlist_position: Mapped[int] = mapped_column(Integer, nullable=True)

    booked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=True)

    member: Mapped["User"] = relationship("User", back_populates="bookings", foreign_keys=[member_id])
    session: Mapped["ClassSession"] = relationship("ClassSession", back_populates="bookings")
