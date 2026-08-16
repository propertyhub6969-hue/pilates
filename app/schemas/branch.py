import uuid
from typing import Optional
from pydantic import BaseModel, Field


class BranchBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    address: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    cancellation_window_hours: Optional[int] = Field(default=None, ge=0, le=168)
    booking_lead_close_hours: Optional[int] = Field(default=None, ge=0, le=168)


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    address: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    cancellation_window_hours: Optional[int] = Field(default=None, ge=0, le=168)
    booking_lead_close_hours: Optional[int] = Field(default=None, ge=0, le=168)
    is_active: Optional[bool] = None


class BranchResponse(BaseModel):
    id: uuid.UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    cancellation_window_hours: int
    booking_lead_close_hours: int
    is_active: bool
    is_default: bool

    class Config:
        from_attributes = True
