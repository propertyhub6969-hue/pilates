import uuid
from typing import Optional
from pydantic import BaseModel, Field


class StudioSettingsResponse(BaseModel):
    id: uuid.UUID
    name: str
    tagline: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    cancellation_window_hours: int
    booking_lead_close_hours: int
    drop_in_price: float = 0
    admin_whatsapp: Optional[str] = None
    bulanan_open_days_before: int = 2
    bulanan_open_time: str = "20:00"
    dropin_open_days_before: int = 1
    dropin_open_time: str = "20:00"
    booking_close_days_before: int = 0
    booking_close_time: str = "00:00"
    default_capacity: int = 14
    min_bulanan: int = 10
    wa_broadcast_enabled: bool = False
    wa_group_bulanan: Optional[str] = None
    booking_url: str = "https://reformeryourbody.com/jadwal"

    class Config:
        from_attributes = True


class StudioSettingsUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    tagline: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    logo_url: Optional[str] = None
    cancellation_window_hours: Optional[int] = Field(default=None, ge=0, le=168)
    booking_lead_close_hours: Optional[int] = Field(default=None, ge=0, le=168)
    drop_in_price: Optional[float] = Field(default=None, ge=0)
    admin_whatsapp: Optional[str] = Field(default=None, max_length=30)
    bulanan_open_days_before: Optional[int] = Field(default=None, ge=0, le=30)
    bulanan_open_time: Optional[str] = Field(default=None, max_length=5)
    dropin_open_days_before: Optional[int] = Field(default=None, ge=0, le=30)
    dropin_open_time: Optional[str] = Field(default=None, max_length=5)
    booking_close_days_before: Optional[int] = Field(default=None, ge=0, le=30)
    booking_close_time: Optional[str] = Field(default=None, max_length=5)
    default_capacity: Optional[int] = Field(default=None, ge=1, le=100)
    min_bulanan: Optional[int] = Field(default=None, ge=0, le=100)
    wa_broadcast_enabled: Optional[bool] = None
    wa_group_bulanan: Optional[str] = Field(default=None, max_length=120)
    booking_url: Optional[str] = Field(default=None, max_length=200)


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
