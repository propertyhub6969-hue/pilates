import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserRole
from app.models.schedule import ClassSession
from app.models.booking import Booking, BookingStatus
from app.schemas.schedule import SessionResponse, MyBookingRow
from app.api.v1.endpoints.schedule import _serialize_sessions
from app.services import booking as booking_svc

router = APIRouter()


class BookRequest(BaseModel):
    session_id: uuid.UUID
    member_id: uuid.UUID | None = None  # diisi hanya bila staf memesan atas nama member


@router.post("", response_model=SessionResponse, status_code=201)
async def create_booking(payload: BookRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Member memesan slot; atau staf memesan atas nama member (isi member_id)."""
    if payload.member_id and payload.member_id != user.id:
        if not user.is_staff():
            raise HTTPException(403, "Tidak boleh memesan atas nama orang lain")
        member = (await db.execute(select(User).where(User.id == payload.member_id))).scalar_one_or_none()
        if not member or member.role != UserRole.MEMBER:
            raise HTTPException(404, "Member tidak ditemukan")
        member_id = payload.member_id
    else:
        if user.role != UserRole.MEMBER and not user.is_staff():
            raise HTTPException(403, "Hanya member yang bisa memesan untuk dirinya")
        member_id = user.id

    session = (await db.execute(select(ClassSession).where(ClassSession.id == payload.session_id))).scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Sesi tidak ditemukan")

    await booking_svc.book_session(db, session, member_id)
    await db.refresh(session)
    return (await _serialize_sessions(db, [session], user))[0]


@router.post("/{booking_id}/cancel", response_model=SessionResponse)
async def cancel_booking(booking_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    booking = (await db.execute(select(Booking).where(Booking.id == booking_id))).scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking tidak ditemukan")
    if booking.member_id != user.id and not user.is_staff():
        raise HTTPException(403, "Tidak boleh membatalkan booking orang lain")

    await booking_svc.cancel_booking(db, booking)
    session = (await db.execute(select(ClassSession).where(ClassSession.id == booking.session_id))).scalar_one()
    return (await _serialize_sessions(db, [session], user))[0]


@router.get("/me", response_model=list[MyBookingRow])
async def my_bookings(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Booking aktif milik saya (mendatang), utk halaman 'Jadwalku'."""
    rows = (
        await db.execute(
            select(Booking, ClassSession)
            .join(ClassSession, Booking.session_id == ClassSession.id)
            .where(
                Booking.member_id == user.id,
                Booking.status.in_([BookingStatus.BOOKED, BookingStatus.WAITLIST]),
                ClassSession.session_date >= date.today(),
            )
            .order_by(ClassSession.session_date, ClassSession.start_time)
        )
    ).all()
    sessions = [s for _, s in rows]
    ser = {s.id: r for s, r in zip(sessions, await _serialize_sessions(db, sessions, user))}
    out = []
    for b, s in rows:
        out.append(MyBookingRow(id=b.id, status=b.status, waitlist_position=b.waitlist_position, session=ser[s.id]))
    return out
