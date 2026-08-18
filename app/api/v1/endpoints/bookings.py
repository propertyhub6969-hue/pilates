import uuid
from datetime import date, time, datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, require_staff
from app.models.user import User, UserRole
from app.models.schedule import ClassSession
from app.models.booking import Booking, BookingStatus
from app.schemas.schedule import SessionResponse, MyBookingRow, BookingRow
from app.api.v1.endpoints.schedule import _serialize_sessions
from app.services import booking as booking_svc

router = APIRouter()


class AttendanceUpdate(BaseModel):
    # booked (belum absen) ↔ attended (hadir) ↔ no_show (tidak hadir).
    # Kuota dipotong saat HADIR. no_show: forfeit=True → sesi HANGUS (kuota terpakai),
    # forfeit=False → sesi TETAP (kuota kembali). Undo → kuota dikembalikan.
    status: Literal["booked", "attended", "no_show"]
    forfeit: bool = True


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

    # Staf yang memesan atas nama member melewati aturan jendela waktu.
    await booking_svc.book_session(db, session, member_id, bypass_window=user.is_staff())
    await db.refresh(session)
    return (await _serialize_sessions(db, [session], user))[0]


@router.post("/{booking_id}/cancel", response_model=SessionResponse)
async def cancel_booking(booking_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # Member TIDAK boleh membatalkan sepihak — hanya staf/admin (semua kategori member).
    if not user.is_staff():
        raise HTTPException(403, "Pembatalan hanya bisa dilakukan admin. Hubungi admin studio.")
    booking = (await db.execute(select(Booking).where(Booking.id == booking_id))).scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking tidak ditemukan")

    await booking_svc.cancel_booking(db, booking)
    session = (await db.execute(select(ClassSession).where(ClassSession.id == booking.session_id))).scalar_one()
    return (await _serialize_sessions(db, [session], user))[0]


@router.patch("/{booking_id}/attendance", response_model=BookingRow)
async def set_attendance(
    booking_id: uuid.UUID,
    payload: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Tandai kehadiran peserta (check-in). Hanya untuk booking yang terkonfirmasi;
    waitlist/cancelled tidak bisa. Tidak mengubah kuota."""
    booking = (await db.execute(select(Booking).where(Booking.id == booking_id))).scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking tidak ditemukan")
    if booking.status not in (BookingStatus.BOOKED, BookingStatus.ATTENDED, BookingStatus.NO_SHOW):
        raise HTTPException(400, "Hanya peserta terdaftar yang bisa diabsen (bukan waitlist/batal)")

    target = BookingStatus(payload.status)
    # Kuota dikonsumsi bila HADIR, atau TIDAK HADIR + hangus. Rekonsiliasi vs kondisi saat ini.
    want_consumed = target == BookingStatus.ATTENDED or (target == BookingStatus.NO_SHOW and payload.forfeit)
    currently_consumed = booking.member_package_id is not None
    if currently_consumed and not want_consumed:
        await booking_svc.refund_one(db, booking.member_package_id)
        booking.member_package_id = None
    elif not currently_consumed and want_consumed:
        mp = await booking_svc.consume_one(db, booking.member_id)
        booking.member_package_id = mp.id if mp else None

    booking.status = target
    booking.checked_in_at = datetime.now(timezone.utc) if target == BookingStatus.ATTENDED else None
    await db.flush()

    name = (await db.execute(select(User.full_name).where(User.id == booking.member_id))).scalar_one_or_none()
    row = BookingRow.model_validate(booking)
    row.member_name = name
    row.consumed = booking.member_package_id is not None
    return row


class MyHistoryRow(BaseModel):
    session_date: date
    start_time: time
    title: str
    status: BookingStatus


@router.get("/me/history", response_model=list[MyHistoryRow])
async def my_history(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Riwayat kehadiran member: kelas yang sudah lewat & pernah didaftari."""
    rows = (
        await db.execute(
            select(ClassSession.session_date, ClassSession.start_time, ClassSession.title, Booking.status)
            .join(ClassSession, Booking.session_id == ClassSession.id)
            .where(
                Booking.member_id == user.id,
                ClassSession.session_date < booking_svc.today_local(),
                Booking.status.in_([BookingStatus.BOOKED, BookingStatus.ATTENDED, BookingStatus.NO_SHOW]),
            )
            .order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc())
            .limit(100)
        )
    ).all()
    return [MyHistoryRow(session_date=d, start_time=t, title=ti, status=s) for d, t, ti, s in rows]


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
                ClassSession.session_date >= booking_svc.today_local(),
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
