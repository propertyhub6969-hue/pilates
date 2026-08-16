from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class StudioSettings(BaseModel):
    """
    Pengaturan studio (baris tunggal / singleton).
    Menyimpan identitas & aturan bisnis global. Disiapkan sebagai tabel terpisah
    supaya mudah dijadikan multi-tenant nanti (tinggal tambah kolom pembeda).
    """
    __tablename__ = "studio_settings"

    name: Mapped[str] = mapped_column(String(150), nullable=False, default="Reformer Your Body")
    tagline: Mapped[str] = mapped_column(String(200), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # Aturan bisnis
    # Batas jam batal booking agar kuota dikembalikan. Batal < jam ini → kuota hangus (no-show).
    cancellation_window_hours: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    # Berapa jam sebelum kelas mulai member masih boleh booking (0 = sampai mulai).
    booking_lead_close_hours: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
