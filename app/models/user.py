import enum
from datetime import date
from sqlalchemy import String, Boolean, Date, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    OWNER = "owner"            # Pemilik studio — akses penuh, termasuk pengaturan & keuangan
    ADMIN = "admin"           # Admin/front-desk — kelola member, jadwal, pembayaran, check-in
    INSTRUCTOR = "instructor"  # Instruktur — lihat jadwal ngajar, absensi peserta
    MEMBER = "member"         # Member/peserta — booking kelas, lihat paket & kuota


class MemberCategory(str, enum.Enum):
    BULANAN = "bulanan"        # Member bulanan (langganan)
    PRIVATE = "private"        # Private training (1-on-1)
    PER_DATANG = "per_datang"  # Bayar per datang (drop-in)


# Peran yang mengelola operasional studio (bukan member/instruktur biasa)
STAFF_ROLES = {UserRole.OWNER, UserRole.ADMIN}


class User(BaseModel):
    """
    Pengguna aplikasi studio: pemilik, admin, instruktur, atau member.
    Semua login lewat tabel yang sama; `role` menentukan hak akses & halaman default.
    """
    __tablename__ = "users"

    # Identity
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    avatar_path: Mapped[str] = mapped_column(String(300), nullable=True)  # foto profil (di /app/uploads/avatars)

    # Role & status
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.MEMBER, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Kategori member (bulanan/private/per_datang) — hanya relevan utk role member
    member_category: Mapped[MemberCategory] = mapped_column(
        SAEnum(MemberCategory), nullable=True, index=True
    )

    # Data member (opsional — hanya relevan utk role member/instruktur)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=True)
    join_date: Mapped[date] = mapped_column(Date, nullable=True)
    emergency_contact: Mapped[str] = mapped_column(String(120), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)  # catatan medis/preferensi

    # Relationships
    member_packages: Mapped[list["MemberPackage"]] = relationship(
        "MemberPackage", back_populates="member", foreign_keys="MemberPackage.member_id"
    )
    bookings: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="member", foreign_keys="Booking.member_id"
    )

    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES

    def __repr__(self) -> str:
        return f"<User {self.email} [{self.role.value}]>"
