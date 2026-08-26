import uuid
from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.schedule import ClassSessionStatus, SessionCategory
from app.models.booking import BookingStatus


# ── Template kelas berulang ──
class TemplateBase(BaseModel):
    branch_id: uuid.UUID
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    instructor_id: Optional[uuid.UUID] = None
    day_of_week: int = Field(ge=0, le=6, description="0=Senin … 6=Minggu")
    start_time: time
    duration_minutes: int = Field(default=55, ge=15, le=240)
    capacity: int = Field(default=14, ge=1, le=100)
    room: Optional[str] = None
    category: SessionCategory = SessionCategory.UMUM
    is_active: bool = True


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    instructor_id: Optional[uuid.UUID] = None
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=240)
    capacity: Optional[int] = Field(default=None, ge=1, le=100)
    room: Optional[str] = None
    category: Optional[SessionCategory] = None
    is_active: Optional[bool] = None


class TemplateResponse(TemplateBase):
    id: uuid.UUID
    instructor_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── Generate sesi dari template ──
class GenerateRequest(BaseModel):
    weeks: int = Field(default=4, ge=1, le=12, description="Generate sesi utk N minggu ke depan")
    branch_id: Optional[uuid.UUID] = Field(default=None, description="Batasi ke satu cabang; None = semua cabang")


class GenerateResult(BaseModel):
    created: int
    skipped: int


# ── Sesi kelas konkret ──
class SessionCreate(BaseModel):
    branch_id: uuid.UUID
    title: str = Field(min_length=2, max_length=150)
    instructor_id: Optional[uuid.UUID] = None
    session_date: date
    start_time: time
    duration_minutes: int = Field(default=55, ge=15, le=240)
    capacity: int = Field(default=14, ge=1, le=100)
    room: Optional[str] = None
    category: SessionCategory = SessionCategory.UMUM
    notes: Optional[str] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    instructor_id: Optional[uuid.UUID] = None
    session_date: Optional[date] = None
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=240)
    capacity: Optional[int] = Field(default=None, ge=1, le=100)
    room: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[ClassSessionStatus] = None


class SessionResponse(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    branch_name: Optional[str] = None
    title: str
    instructor_id: Optional[uuid.UUID] = None
    instructor_name: Optional[str] = None
    assistant_id: Optional[uuid.UUID] = None
    assistant_name: Optional[str] = None
    session_date: date
    start_time: time
    duration_minutes: int
    capacity: int
    room: Optional[str] = None
    category: SessionCategory = SessionCategory.UMUM
    status: ClassSessionStatus
    notes: Optional[str] = None
    booked_count: int = 0
    waitlist_count: int = 0
    # Konteks utk pemanggil (member): status booking dia di sesi ini
    my_booking_status: Optional[BookingStatus] = None
    my_booking_id: Optional[uuid.UUID] = None
    my_can_cancel: bool = False   # member boleh batalkan booking-nya (> batas jam sblm mulai)
    # Status jendela booking utk pemanggil
    slots_remaining: int = 0
    booking_state: str = "open"          # not_open | open | full | closed | cancelled
    booking_opens_at: Optional[datetime] = None
    booking_closes_at: Optional[datetime] = None
    can_book: bool = False
    bulanan_count: int = 0               # jumlah bulanan yang sudah booking (staf)
    is_underfilled: bool = False         # bulanan < target minimal → "sesi sepi"

    class Config:
        from_attributes = True


class RescheduleRequest(BaseModel):
    session_date: date
    start_time: time
    notify: bool = True                  # kirim WA ke peserta terdaftar (best-effort)


# ── Booking ──
class BookingRow(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    member_id: uuid.UUID
    member_name: Optional[str] = None
    status: BookingStatus
    waitlist_position: Optional[int] = None
    booked_at: datetime
    checked_in_at: Optional[datetime] = None
    consumed: bool = False   # kuota sudah dipotong (hadir / no-show hangus)

    class Config:
        from_attributes = True


class MyBookingRow(BaseModel):
    id: uuid.UUID
    status: BookingStatus
    waitlist_position: Optional[int] = None
    session: SessionResponse

    class Config:
        from_attributes = True


class StaffBookRequest(BaseModel):
    member_id: uuid.UUID
