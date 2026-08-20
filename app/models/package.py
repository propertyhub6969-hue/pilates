import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Numeric, Boolean, Text, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class Package(BaseModel):
    """
    Katalog paket yang dijual studio (mis. "10 Sesi Reformer", "Unlimited Bulanan").
    Ini template harga; yang dimiliki member ada di MemberPackage.
    """
    __tablename__ = "packages"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Jumlah sesi. NULL/None + is_unlimited=True → paket tak terbatas (unlimited).
    session_count: Mapped[int] = mapped_column(Integer, nullable=True)
    is_unlimited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    # Potongan harga (Rp) saat member PERPANJANG paket ini sementara paket lamanya belum expired.
    # 0 = tak ada diskon. Diterapkan hanya di jual paket oleh admin.
    renewal_discount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    # Masa berlaku sejak tanggal beli (hari). NULL = tak kedaluwarsa.
    validity_days: Mapped[int] = mapped_column(Integer, nullable=True)
    # Paket bulanan: kedaluwarsa AKHIR BULAN pembayaran + akumulasi sisa saat perpanjang tepat waktu.
    monthly_expiry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class MemberPackageStatus(str, enum.Enum):
    ACTIVE = "active"        # masih ada kuota & belum kedaluwarsa
    USED_UP = "used_up"      # kuota habis
    EXPIRED = "expired"      # lewat masa berlaku
    FROZEN = "frozen"        # dibekukan sementara (mis. member cuti)
    CANCELLED = "cancelled"  # dibatalkan admin


class MemberPackage(BaseModel):
    """
    Paket yang DIBELI seorang member = saldo/kredit sesi miliknya.
    Field di-snapshot dari Package saat beli, supaya perubahan katalog tak mengubah
    paket yang sudah dibeli.
    """
    __tablename__ = "member_packages"

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    package_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("packages.id", ondelete="SET NULL"), nullable=True
    )

    # Snapshot saat pembelian
    package_name: Mapped[str] = mapped_column(String(150), nullable=False)
    is_unlimited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    monthly_expiry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # snapshot aturan bulanan
    sessions_total: Mapped[int] = mapped_column(Integer, nullable=True)      # None utk unlimited
    sessions_remaining: Mapped[int] = mapped_column(Integer, nullable=True)  # saldo berjalan
    price_paid: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_reminded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)   # penanda reminder H-1 kedaluwarsa
    expiry_reminded_7d_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)  # penanda reminder H-7 (paket panjang)

    status: Mapped[MemberPackageStatus] = mapped_column(
        SAEnum(MemberPackageStatus), default=MemberPackageStatus.ACTIVE, nullable=False, index=True
    )

    # Relationships
    member: Mapped["User"] = relationship(
        "User", back_populates="member_packages", foreign_keys=[member_id]
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="member_package")
