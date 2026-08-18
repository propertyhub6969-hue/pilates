import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class PackageBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    is_unlimited: bool = False
    session_count: Optional[int] = Field(default=None, ge=1)
    price: float = Field(ge=0)
    validity_days: Optional[int] = Field(default=None, ge=1)
    monthly_expiry: bool = False
    is_active: bool = True

    @field_validator("session_count")
    @classmethod
    def _sessions_required_when_limited(cls, v, info):
        # Kalau bukan unlimited, wajib ada jumlah sesi.
        if not info.data.get("is_unlimited") and v is None:
            raise ValueError("Jumlah sesi wajib diisi untuk paket non-unlimited")
        return v


class PackageCreate(PackageBase):
    pass


class PackageUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    is_unlimited: Optional[bool] = None
    session_count: Optional[int] = Field(default=None, ge=1)
    price: Optional[float] = Field(default=None, ge=0)
    validity_days: Optional[int] = Field(default=None, ge=1)
    monthly_expiry: Optional[bool] = None
    is_active: Optional[bool] = None


class PackageResponse(PackageBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
