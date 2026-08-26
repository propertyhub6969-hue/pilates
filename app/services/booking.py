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
from app.models.user import User, MemberCategory
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.services.quota import is_usable, refresh_status

TZ = ZoneInfo(settings.TIMEZONE)


def now_local() -> datetime:
    return datetime.now(TZ)


def today_local() -> date:
    """Tanggal 'hari ini' menurut zona studio (WITA) — bukan UTC container."""
    return datetime.now(TZ).date()


def session_start_dt(session: ClassSession) -> datetime:
    """Waktu mulai sesi sebagai datetime sadar-zona (zona studio)."""
    return datetime.combine(session.session_date, session.start_time, tzinfo=TZ)


def _parse_hhmm(s: str) -> time:
    try:
        hh, mm = (s or "").split(":")
        return time(int(hh), int(mm))
    except Exception:  # noqa: BLE001
        return time(20, 0)


def _win_dt(session_date, days_before: int, hhmm: str) -> datetime:
    """Titik waktu jendela = (session_date − days_before) pukul hhmm, zona studio."""
    d = session_date - timedelta(days=days_before or 0)
    return datetime.combine(d, _parse_hhmm(hhmm), tzinfo=TZ)


def booking_open_dt(studio: StudioSettings, session: ClassSession, category) -> datetime:
    """Kapan booking dibuka untuk kategori ini (per-datang lebih lambat)."""
    if category == MemberCategory.PER_DATANG:
        return _win_dt(session.session_date, studio.dropin_open_days_before, studio.dropin_open_time)
    return _win_dt(session.session_date, studio.bulanan_open_days_before, studio.bulanan_open_time)


def booking_close_dt(studio: StudioSettings, session: ClassSession) -> datetime:
    """Kapan booking ditutup (default: tengah malam masuk hari-H = akhir H-1)."""
    return _win_dt(session.session_date, studio.booking_close_days_before, studio.booking_close_time)


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


# Slot "terisi" = semua yang mengambil slot (booked/hadir/tidak-hadir) — TIDAK termasuk
# waitlist & cancelled. Menandai kehadiran tak mengubah jumlah terisi.
_SLOT_STATUSES = [BookingStatus.BOOKED, BookingStatus.ATTENDED, BookingStatus.NO_SHOW]


async def booked_count(db: AsyncSession, session_id) -> int:
    return (
        await db.execute(
            select(func.count()).select_from(Booking).where(
                Booking.session_id == session_id, Booking.status.in_(_SLOT_STATUSES)
            )
        )
    ).scalar_one()


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


async def _ensure_dropin_payment(db: AsyncSession, booking: Booking, session: ClassSession) -> None:
    """Tagihan drop-in (per datang) utk booking ini. Bila member sudah punya tagihan drop-in
    yang belum terpakai (mis. dari aktivasi), pakai itu; kalau tidak, buat baru. Status PENDING."""
    exists = (
        await db.execute(select(Payment).where(Payment.booking_id == booking.id))
    ).scalar_one_or_none()
    if exists:
        return
    d = session.session_date
    label = f"Drop-in (per datang) — {session.title}, {d.day}/{d.month}/{d.year}"
    # Tagihan drop-in belum terpakai (booking_id NULL) → pasangkan ke booking ini.
    unattached = (
        await db.execute(
            select(Payment).where(
                Payment.member_id == booking.member_id,
                Payment.booking_id.is_(None),
                Payment.member_package_id.is_(None),
                Payment.note.like("Drop-in%"),
                Payment.status == PaymentStatus.PENDING,
            ).order_by(Payment.created_at.asc()).limit(1)
        )
    ).scalar_one_or_none()
    if unattached is not None:
        unattached.booking_id = booking.id
        unattached.note = label
        return
    studio = await get_studio(db)
    db.add(Payment(
        member_id=booking.member_id,
        booking_id=booking.id,
        amount=float(studio.drop_in_price or 0),
        method=PaymentMethod.CASH,
        status=PaymentStatus.PENDING,
        note=label,
    ))


async def _void_dropin_payment(db: AsyncSession, booking: Booking) -> None:
    """Saat booking drop-in dibatalkan: hapus tagihan pending, atau tandai refund bila sudah lunas."""
    pays = (
        await db.execute(select(Payment).where(Payment.booking_id == booking.id))
    ).scalars().all()
    for p in pays:
        if p.status == PaymentStatus.PENDING:
            await db.delete(p)
        elif p.status == PaymentStatus.PAID:
            p.status = PaymentStatus.REFUNDED


async def quota_available(db: AsyncSession, member_id) -> int | None:
    """Total sesi tersedia (belum dikonsumsi) dari paket usable. None = unlimited."""
    rows = (await db.execute(select(MemberPackage).where(MemberPackage.member_id == member_id))).scalars().all()
    usable = [mp for mp in rows if is_usable(mp)]
    if any(mp.is_unlimited for mp in usable):
        return None
    return sum((mp.sessions_remaining or 0) for mp in usable)


async def committed_reservations(db: AsyncSession, member_id) -> int:
    """Jumlah reservasi BOOKED (belum diabsen) — belum mengonsumsi kuota."""
    return (
        await db.execute(
            select(func.count()).select_from(Booking).where(
                Booking.member_id == member_id, Booking.status == BookingStatus.BOOKED
            )
        )
    ).scalar_one()


async def consume_one(db: AsyncSession, member_id) -> MemberPackage | None:
    """Potong 1 kuota dari paket termanfaat (dipanggil saat HADIR / no-show HANGUS)."""
    mp = await _pick_usable_package(db, member_id)
    if mp is None:
        return None
    _hold_quota(mp)
    return mp


async def refund_one(db: AsyncSession, mp_id) -> None:
    """Kembalikan 1 kuota ke paket (dipanggil saat undo hadir / no-show tetap)."""
    mp = (await db.execute(select(MemberPackage).where(MemberPackage.id == mp_id))).scalar_one_or_none()
    if mp:
        _refund_quota(mp)


async def book_session(db: AsyncSession, session: ClassSession, member_id, bypass_window: bool = False) -> Booking:
    """Member memesan slot. `bypass_window=True` untuk staf yang memesan atas nama member
    (lewati aturan jendela waktu). Semua kategori kini pakai kuota paket — per-datang wajib
    punya TIKET drop-in aktif (paket 1 sesi yang sudah dibayar)."""
    if session.status != ClassSessionStatus.SCHEDULED:
        raise HTTPException(400, "Sesi tidak tersedia untuk booking")

    member = (await db.execute(select(User).where(User.id == member_id))).scalar_one_or_none()
    category = member.member_category if member else None
    studio = await get_studio(db)

    # ── Jendela waktu berjenjang (kecuali staf yang bypass) ──
    if not bypass_window:
        now = now_local()
        if now >= booking_close_dt(studio, session):
            raise HTTPException(400, "Pemesanan untuk sesi ini sudah ditutup")
        open_dt = booking_open_dt(studio, session, category)
        if now < open_dt:
            who = "drop-in" if category == MemberCategory.PER_DATANG else "member"
            raise HTTPException(400, f"Pemesanan {who} dibuka {open_dt.strftime('%d/%m %H:%M')} WITA")

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
        if category == MemberCategory.PER_DATANG:
            raise HTTPException(400, "Belum ada tiket drop-in aktif. Beli tiket dulu (1 sesi, bayar lunas).")
        raise HTTPException(400, "Tidak ada paket aktif dengan sisa kuota. Beli/aktifkan paket dulu.")

    # Kuota dipotong saat HADIR (bukan saat booking). Batasi jumlah reservasi ≤ sisa kuota.
    avail = await quota_available(db, member_id)
    if avail is not None:
        if (await committed_reservations(db, member_id)) >= avail:
            raise HTTPException(400, f"Kuota tidak cukup: {avail} sesimu sudah dibooking semua. Hadiri/batalkan salah satu, atau tambah paket.")

    taken = await booked_count(db, session.id)
    go_waitlist = taken >= session.capacity

    booking = existing or Booking(session_id=session.id, member_id=member_id)
    booking.booked_at = now_local()
    booking.cancelled_at = None
    booking.checked_in_at = None
    booking.member_package_id = None  # kuota belum dikonsumsi (dipotong saat absensi)

    if go_waitlist:
        booking.status = BookingStatus.WAITLIST
        booking.waitlist_position = (await waitlist_count(db, session.id)) + 1
    else:
        booking.status = BookingStatus.BOOKED
        booking.waitlist_position = None

    if existing is None:
        db.add(booking)
    await db.flush()
    return booking


async def cancel_booking(db: AsyncSession, booking: Booking) -> None:
    """Batalkan booking (BOOKED/WAITLIST). Kuota TAK terpengaruh (belum dikonsumsi —
    dipotong saat absensi). Slot yang terbuka → promosikan waitlist."""
    if booking.status in (BookingStatus.CANCELLED, BookingStatus.NO_SHOW, BookingStatus.ATTENDED):
        raise HTTPException(400, "Booking ini tidak dapat dibatalkan")

    session = (
        await db.execute(select(ClassSession).where(ClassSession.id == booking.session_id))
    ).scalar_one()
    was_booked = booking.status == BookingStatus.BOOKED

    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = now_local()
    booking.member_package_id = None
    await db.flush()

    if was_booked:
        await _promote_waitlist(db, session)


async def _promote_waitlist(db: AsyncSession, session: ClassSession) -> None:
    """Promosikan waitlist teratas yang masih punya kuota tersisa (belum full booking) jadi BOOKED."""
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
        avail = await quota_available(db, w.member_id)
        if avail is not None and (await committed_reservations(db, w.member_id)) >= avail:
            continue  # kuota sudah habis terbooking → lewati
        w.status = BookingStatus.BOOKED
        w.waitlist_position = None
        w.member_package_id = None
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

    start = today_local()
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
                        category=tpl.category,
                        status=ClassSessionStatus.SCHEDULED,
                    ))
                    created += 1
            d += timedelta(days=1)
    await db.flush()
    return created, skipped
