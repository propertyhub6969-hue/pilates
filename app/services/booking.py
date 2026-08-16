"""
Logika inti jadwal & booking studio pilates.

Aturan kuota:
- Booking terkonfirmasi (BOOKED) MENAHAN 1 kuota dari MemberPackage (decrement).
- Waitlist TIDAK menahan kuota (baru ditahan saat dipromosikan jadi BOOKED).
- Batal TEPAT WAKTU (> cancellation_window_hours sebelum kelas) → kuota DIKEMBALIKAN.
- Batal TERLAMBAT → kuota HANGUS (tak dikembalikan).
- Saat ada slot kosong karena pembatalan, waitlist teratas otomatis dipromosikan.

Kuota unlimited tidak pernah di-decrement/refund.
"""
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.studio import StudioSettings
from app.models.schedule import ClassSession, ClassSessionStatus, ClassTemplate
from app.models.booking import Booking, BookingStatus
from app.models.package import MemberPackage
from app.services.quota import is_usable, refresh_status

TZ = ZoneInfo(settings.TIMEZONE)


def now_local() -> datetime:
    return datetime.now(TZ)


def session_start_dt(session: ClassSession) -> datetime:
    """Waktu mulai sesi sebagai datetime sadar-zona (zona studio)."""
    return datetime.combine(session.session_date, session.start_time, tzinfo=TZ)


async def get_studio(db: AsyncSession) -> StudioSettings:
    s = (await db.execute(select(StudioSettings))).scalars().first()
    if s is None:
        s = StudioSettings()
    return s


async def get_branch(db: AsyncSession, branch_id):
    """Cabang penentu aturan booking (batas batal, tutup booking). Fallback ke StudioSettings."""
    from app.models.branch import Branch
    b = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if b is not None:
        return b
    return await get_studio(db)


async def _count_status(db: AsyncSession, session_id, status: BookingStatus) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(Booking).where(
                Booking.session_id == session_id, Booking.status == status
            )
        )
    ).scalar_one()


async def booked_count(db: AsyncSession, session_id) -> int:
    return await _count_status(db, session_id, BookingStatus.BOOKED)


async def waitlist_count(db: AsyncSession, session_id) -> int:
    return await _count_status(db, session_id, BookingStatus.WAITLIST)


async def _pick_usable_package(db: AsyncSession, member_id) -> MemberPackage | None:
    """Paket termanfaat utk dipakai: prioritaskan yang berkuota & paling cepat kedaluwarsa,
    unlimited sebagai cadangan."""
    rows = (
        await db.execute(select(MemberPackage).where(MemberPackage.member_id == member_id))
    ).scalars().all()
    usable = [mp for mp in rows if is_usable(mp)]
    if not usable:
        return None
    # is_unlimited False dulu (biar kuota terhitung dipakai lebih dulu), lalu expires_at terdekat
    usable.sort(key=lambda mp: (
        mp.is_unlimited,
        mp.expires_at or datetime.max.replace(tzinfo=TZ),
        mp.purchased_at,
    ))
    return usable[0]


def _hold_quota(mp: MemberPackage) -> None:
    if mp and not mp.is_unlimited and mp.sessions_remaining is not None:
        mp.sessions_remaining = max(0, mp.sessions_remaining - 1)
        refresh_status(mp)


def _refund_quota(mp: MemberPackage) -> None:
    if mp and not mp.is_unlimited and mp.sessions_remaining is not None:
        mp.sessions_remaining += 1
        refresh_status(mp)


async def book_session(db: AsyncSession, session: ClassSession, member_id) -> Booking:
    """Member (atau admin atas nama member) memesan slot pada sesi."""
    if session.status != ClassSessionStatus.SCHEDULED:
        raise HTTPException(400, "Sesi tidak tersedia untuk booking")

    branch = await get_branch(db, session.branch_id)
    close = session_start_dt(session) - timedelta(hours=branch.booking_lead_close_hours or 0)
    if now_local() >= close:
        raise HTTPException(400, "Pemesanan untuk sesi ini sudah ditutup")

    # Booking existing utk pasangan (session, member) — karena ada unique constraint.
    existing = (
        await db.execute(
            select(Booking).where(
                Booking.session_id == session.id, Booking.member_id == member_id
            )
        )
    ).scalar_one_or_none()
    if existing and existing.status in (BookingStatus.BOOKED, BookingStatus.WAITLIST, BookingStatus.ATTENDED):
        raise HTTPException(400, "Anda sudah memesan sesi ini")

    mp = await _pick_usable_package(db, member_id)
    if mp is None:
        raise HTTPException(400, "Tidak ada paket aktif dengan sisa kuota. Beli/aktifkan paket dulu.")

    taken = await booked_count(db, session.id)
    go_waitlist = taken >= session.capacity

    booking = existing or Booking(session_id=session.id, member_id=member_id)
    booking.booked_at = now_local()
    booking.cancelled_at = None
    booking.checked_in_at = None

    if go_waitlist:
        booking.status = BookingStatus.WAITLIST
        booking.waitlist_position = (await waitlist_count(db, session.id)) + 1
        booking.member_package_id = None  # kuota belum ditahan utk waitlist
    else:
        booking.status = BookingStatus.BOOKED
        booking.waitlist_position = None
        booking.member_package_id = mp.id
        _hold_quota(mp)

    if existing is None:
        db.add(booking)
    await db.flush()
    return booking


async def cancel_booking(db: AsyncSession, booking: Booking) -> None:
    """Batalkan booking; kembalikan kuota bila tepat waktu; promosikan waitlist."""
    if booking.status in (BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.ATTENDED):
        raise HTTPException(400, "Booking ini tidak dapat dibatalkan")

    session = (
        await db.execute(select(ClassSession).where(ClassSession.id == booking.session_id))
    ).scalar_one()
    branch = await get_branch(db, session.branch_id)

    was_booked = booking.status == BookingStatus.BOOKED
    timely = now_local() < session_start_dt(session) - timedelta(hours=branch.cancellation_window_hours or 0)

    # Kembalikan kuota hanya bila slot terkonfirmasi & dibatalkan tepat waktu
    if was_booked and timely and booking.member_package_id:
        mp = (
            await db.execute(select(MemberPackage).where(MemberPackage.id == booking.member_package_id))
        ).scalar_one_or_none()
        if mp:
            _refund_quota(mp)

    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = now_local()
    booking.member_package_id = None
    await db.flush()

    # Slot terbuka → promosikan waitlist teratas
    if was_booked:
        await _promote_waitlist(db, session)


async def _promote_waitlist(db: AsyncSession, session: ClassSession) -> None:
    """Promosikan booking waitlist teratas yang masih punya kuota jadi BOOKED."""
    if await booked_count(db, session.id) >= session.capacity:
        return
    waiters = (
        await db.execute(
            select(Booking).where(
                Booking.session_id == session.id, Booking.status == BookingStatus.WAITLIST
            ).order_by(Booking.waitlist_position.asc().nulls_last(), Booking.booked_at.asc())
        )
    ).scalars().all()
    for w in waiters:
        mp = await _pick_usable_package(db, w.member_id)
        if mp is None:
            continue  # lewati yg tak punya kuota, coba berikutnya
        w.status = BookingStatus.BOOKED
        w.waitlist_position = None
        w.member_package_id = mp.id
        _hold_quota(mp)
        await db.flush()
        break


async def generate_sessions(db: AsyncSession, weeks: int, branch_id=None) -> tuple[int, int]:
    """Generate ClassSession dari template aktif utk `weeks` minggu ke depan.
    Bila branch_id diisi → hanya cabang itu; None → semua cabang.
    Idempoten: lewati bila sesi (template, tanggal) sudah ada. Return (created, skipped)."""
    stmt = select(ClassTemplate).where(ClassTemplate.is_active.is_(True))
    if branch_id is not None:
        stmt = stmt.where(ClassTemplate.branch_id == branch_id)
    templates = (await db.execute(stmt)).scalars().all()

    start = date.today()
    end = start + timedelta(weeks=weeks)
    created = skipped = 0

    for tpl in templates:
        d = start
        while d <= end:
            if d.weekday() == tpl.day_of_week:
                exists = (
                    await db.execute(
                        select(ClassSession).where(
                            ClassSession.template_id == tpl.id, ClassSession.session_date == d
                        )
                    )
                ).scalar_one_or_none()
                if exists:
                    skipped += 1
                else:
                    db.add(ClassSession(
                        branch_id=tpl.branch_id,
                        template_id=tpl.id,
                        title=tpl.name,
                        instructor_id=tpl.instructor_id,
                        session_date=d,
                        start_time=tpl.start_time,
                        duration_minutes=tpl.duration_minutes,
                        capacity=tpl.capacity,
                        room=tpl.room,
                        status=ClassSessionStatus.SCHEDULED,
                    ))
                    created += 1
            d += timedelta(days=1)
    await db.flush()
    return created, skipped
