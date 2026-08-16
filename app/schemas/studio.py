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


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
