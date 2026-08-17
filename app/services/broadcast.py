"""Broadcast jadwal via WhatsApp (Fase 2).

- Bulanan/Private: SATU pesan ke GRUP (risiko rendah) saat jadwal terbit (H-2).
- Per-datang: pesan PERSONAL (sebut nama) ke pemegang tiket aktif, dikirim
  satu-satu dengan JEDA acak (menghindari pola broadcast massal), saat H-1.
"""
import asyncio
import random
from datetime import date, time
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.studio import StudioSettings
from app.models.schedule import ClassSession, ClassSessionStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole, MemberCategory
from app.models.package import MemberPackage, MemberPackageStatus
from app.services.whatsapp import send_whatsapp, send_whatsapp_group

_DOW = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
_MON = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _date_label(d: date) -> str:
    return f"{_DOW[d.weekday()]}, {d.day} {_MON[d.month]} {d.year}"


def _hhmm(t: time) -> str:
    return t.strftime("%H:%M")


async def _studio(db: AsyncSession) -> StudioSettings | None:
    return (await db.execute(select(StudioSettings))).scalars().first()


async def _sessions_on(db: AsyncSession, target_date: date, branch_id=None):
    stmt = select(ClassSession).where(
        ClassSession.session_date == target_date,
        ClassSession.status == ClassSessionStatus.SCHEDULED,
    )
    if branch_id is not None:
        stmt = stmt.where(ClassSession.branch_id == branch_id)
    return (await db.execute(stmt.order_by(ClassSession.start_time))).scalars().all()


async def _booked(db: AsyncSession, session_id) -> int:
    return (await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.session_id == session_id, Booking.status == BookingStatus.BOOKED)
    )).scalar_one()


async def announce_bulanan(db: AsyncSession, target_date: date) -> dict:
    """Post SATU pesan jadwal ke grup bulanan/private."""
    studio = await _studio(db)
    if not studio or not studio.wa_group_bulanan:
        return {"ok": False, "reason": "grup WhatsApp belum dipilih di Pengaturan"}
    sessions = await _sessions_on(db, target_date)
    if not sessions:
        return {"ok": False, "reason": f"tidak ada sesi pada {target_date}"}
    lines = []
    for s in sessions:
        slots = max(0, s.capacity - await _booked(db, s.id))
        lines.append(f"• {_hhmm(s.start_time)} {s.title}" + (f" — sisa {slots} slot" if slots > 0 else " — PENUH"))
    msg = (
        f"*Jadwal {_date_label(target_date)}* — {studio.name}\n"
        f"Booking dibuka untuk member *bulanan & private* 🎯\n\n"
        + "\n".join(lines)
        + f"\n\nBuruan pilih kelasmu (siapa cepat dia dapat):\n{studio.booking_url}"
    )
    ok, info = await send_whatsapp_group(studio.wa_group_bulanan, msg)
    return {"ok": ok, "info": info, "sessions": len(sessions), "target_date": str(target_date)}


async def notify_dropin(db: AsyncSession, target_date: date, jitter=(3.0, 7.0)) -> dict:
    """Pesan personal (sebut nama) ke per-datang pemegang tiket aktif, dgn jeda antar-kirim."""
    studio = await _studio(db)
    booking_url = studio.booking_url if studio else "https://reformeryourbody.com/jadwal"
    sessions = await _sessions_on(db, target_date)
    if not sessions:
        return {"ok": False, "reason": f"tidak ada sesi pada {target_date}"}

    # Per-datang aktif yang punya tiket (paket aktif berkuota) + nomor HP
    ticket_holders = (
        select(MemberPackage.member_id).where(
            MemberPackage.status == MemberPackageStatus.ACTIVE,
            MemberPackage.is_unlimited.is_(False),
            MemberPackage.sessions_remaining > 0,
        ).distinct()
    )
    members = (
        await db.execute(
            select(User).where(
                User.role == UserRole.MEMBER,
                User.member_category == MemberCategory.PER_DATANG,
                User.is_active.is_(True),
                User.phone.isnot(None),
                User.id.in_(ticket_holders),
            )
        )
    ).scalars().all()
    if not members:
        return {"ok": True, "sent": 0, "total": 0, "reason": "tak ada per-datang bertiket"}

    sent = 0
    for i, m in enumerate(members):
        if i > 0:
            await asyncio.sleep(random.uniform(*jitter))
        msg = (
            f"Halo {m.full_name}, masih ada slot *drop-in* untuk kelas besok "
            f"({_date_label(target_date)}) 🎟️\n"
            f"Kamu punya tiket aktif — tinggal pilih kelas & booking:\n{booking_url}"
        )
        ok, _info = await send_whatsapp(m.phone, msg)
        if ok:
            sent += 1
    return {"ok": True, "sent": sent, "total": len(members), "target_date": str(target_date)}
