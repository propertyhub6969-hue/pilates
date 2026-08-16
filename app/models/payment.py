import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, Text, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    TRANSFER = "transfer"
    QRIS = "qris"
    CARD = "card"
    OTHER = "other"


class PaymentStatus(str, enum.Enum):
    PAID = "paid"        # lunas
    PENDING = "pending"  # menunggu (mis. transfer belum diverifikasi)
    REFUNDED = "refunded"


class Payment(BaseModel):
    """
    Catatan pembayaran (manual). Umumnya melekat ke pembelian sebuah MemberPackage,
    tapi member_package_id opsional agar bisa dipakai utk pembayaran lain nanti.
    """
    __tablename__ = "payments"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("member_packages.id", ondelete="SET NULL"), nullable=True
    )

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod), default=PaymentMethod.CASH, nullable=False
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus), default=PaymentStatus.PAID, nullable=False, index=True
    )
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=True)

    # Siapa yang mencatat (admin/owner)
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    member_package: Mapped["MemberPackage"] = relationship("MemberPackage", back_populates="payments")
