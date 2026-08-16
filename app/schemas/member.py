import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole
from app.models.package import MemberPackageStatus
from app.models.payment import PaymentMethod, PaymentStatus


# ── User (member / instruktur / admin) ──
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2, max_length=200)
    phone: Optional[str] = None
    role: UserRole = UserRole.MEMBER
    date_of_birth: Optional[date] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class UserBrief(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    # Ringkasan kuota (diisi utk role member)
    active_sessions_remaining: Optional[int] = None
    has_unlimited: bool = False

    class Config:
        from_attributes = True


# ── MemberPackage (saldo kuota) ──
class MemberPackageResponse(BaseModel):
    id: uuid.UUID
    package_name: str
    is_unlimited: bool
    sessions_total: Optional[int] = None
    sessions_remaining: Optional[int] = None
    price_paid: float
    purchased_at: datetime
    expires_at: Optional[datetime] = None
    status: MemberPackageStatus

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    id: uuid.UUID
    amount: float
    method: PaymentMethod
    status: PaymentStatus
    paid_at: Optional[datetime] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MemberDetail(UserBrief):
    date_of_birth: Optional[date] = None
    join_date: Optional[date] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    packages: List[MemberPackageResponse] = []
    payments: List[PaymentResponse] = []
    # Ringkasan kuota aktif (dijumlahkan dari paket berstatus active)
    active_sessions_remaining: Optional[int] = None
    has_unlimited: bool = False

    class Config:
        from_attributes = True


# ── Jual paket ke member ──
class PurchaseCreate(BaseModel):
    package_id: uuid.UUID
    price_paid: Optional[float] = Field(default=None, ge=0)  # default: harga katalog
    method: PaymentMethod = PaymentMethod.CASH
    mark_paid: bool = True                                    # False → pembayaran pending
    purchased_at: Optional[datetime] = None                  # default: sekarang
    note: Optional[str] = None
