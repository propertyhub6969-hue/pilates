from sqlalchemy import String, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class Branch(BaseModel):
    """
    Cabang / lokasi studio. Satu studio (brand) bisa punya banyak cabang.
    Jadwal, sesi, dan aturan booking di-scope per cabang; member & paket dibagi
    seluruh studio (satu keanggotaan berlaku di semua cabang).
    """
    __tablename__ = "branches"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)

    # Aturan booking per cabang (default dari StudioSettings saat cabang dibuat)
    cancellation_window_hours: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    booking_lead_close_hours: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
