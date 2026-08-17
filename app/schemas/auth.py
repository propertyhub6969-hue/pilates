import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole, MemberCategory
from app.models.payment import PaymentMethod


class MemberRegister(BaseModel):
    """Registrasi mandiri oleh member baru (self sign-up dari HP)."""
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2, max_length=200)
    phone: Optional[str] = None
    # Self-enrollment: pilih kategori + (opsional) paket yang dibeli sekaligus
    member_category: Optional[MemberCategory] = None
    package_id: Optional[uuid.UUID] = None
    payment_method: PaymentMethod = PaymentMethod.TRANSFER


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class ForgotPassword(BaseModel):
    """Nomor WA / email terdaftar untuk minta kode reset."""
    identifier: str = Field(min_length=3, max_length=255)


class ResetPassword(BaseModel):
    identifier: str = Field(min_length=3, max_length=255)
    code: str = Field(min_length=4, max_length=8)
    new_password: str = Field(min_length=6, max_length=128)


class SetPassword(BaseModel):
    """Admin menetapkan password baru untuk seorang user."""
    new_password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    avatar_path: Optional[str] = None
    date_of_birth: Optional[date] = None
    join_date: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
