from sqlalchemy import String, Integer, Text, Numeric, Boolean
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

    # Harga sekali datang (drop-in) untuk member kategori "per datang" tanpa paket.
    drop_in_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # ── Jendela booking berjenjang (semua waktu zona studio / WITA) ──
    # Bulanan/Private booking dibuka H-<days> pukul <time>. Default: H-2 20:00.
    bulanan_open_days_before: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    bulanan_open_time: Mapped[str] = mapped_column(String(5), default="20:00", nullable=False)
    # Per-datang booking dibuka H-<days> pukul <time>. Default: H-1 20:00.
    dropin_open_days_before: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    dropin_open_time: Mapped[str] = mapped_column(String(5), default="20:00", nullable=False)
    # Booking ditutup H-<days> pukul <time>. Default: H-0 00:00 (= akhir H-1 / tengah malam hari-H).
    booking_close_days_before: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    booking_close_time: Mapped[str] = mapped_column(String(5), default="00:00", nullable=False)
    # Kapasitas & target minimal per sesi kelas grup.
    default_capacity: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    min_bulanan: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # ── Broadcast jadwal via WhatsApp (Fase 2) ──
    wa_broadcast_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    wa_group_bulanan: Mapped[str] = mapped_column(String(120), nullable=True)   # JID grup bulanan+private
    booking_url: Mapped[str] = mapped_column(String(200), default="https://reformeryourbody.com/jadwal", nullable=False)

    # Nomor WhatsApp admin yang menerima notifikasi (mis. bukti transfer masuk).
    admin_whatsapp: Mapped[str] = mapped_column(String(30), nullable=True)
