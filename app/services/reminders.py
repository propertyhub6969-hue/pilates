"""Kirim pengingat WhatsApp. Dua jenis, masing-masing idempoten via kolom penanda:
  - 'h1'  : H-1, sehari sebelum (untuk semua kelas besok)      → Booking.reminder_sent_at
  - 'h2'  : ±X jam sebelum kelas mulai (default 2 jam)          → Booking.reminder_2h_sent_at
"""
from datetime import date, timedelta, datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.schedule import ClassSession, ClassSessionStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User
from app.services.whatsapp import send_whatsapp
from app.services.booking import now_local, session_start_dt

DAY_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

# Konfigurasi per jenis: kolom penanda + penyusun pesan
_KINDS = ("h1", "h2")


def _compose_h1(name: str, s: ClassSession) -> str:
    d = s.session_date
    hari = f"{DAY_ID[d.weekday()]}, {d.day}/{d.month}/{d.year}"
    room = f"\nRuang: {s.room}" if s.room else ""
    first = (name or "Kak").split(" ")[0]
    return (
        f"Halo {first} 👋\n\n"
        f"Pengingat kelas *{s.title}* besok:\n"
        f"🗓️ {hari}\n⏰ {s.start_time.strftime('%H:%M')} WIB{room}\n\n"
        f"Sampai jumpa di studio! 🧘\n"
        f"_Balas pesan ini bila berhalangan hadir agar slot bisa dipakai member lain._\n\n"
        f"— {settings.STUDIO_WA_SIGNATURE}"
    )


def _compose_h2(name: str, s: ClassSession) -> str:
    room = f" · Ruang {s.room}" if s.room else ""
    first = (name or "Kak").split(" ")[0]
    return (
        f"Halo {first} 👋\n\n"
        f"Kelas *{s.title}* kamu mulai *sebentar lagi* — hari ini pukul "
        f"*{s.start_time.strftime('%H:%M')} WIB*{room}.\n\n"
        f"Sampai jumpa di studio ya! 🧘\n\n"
        f"— {settings.STUDIO_WA_SIGNATURE}"
    )


async def _sessions_for(db: AsyncSession, kind: str) -> list[ClassSession]:
    now = now_local()
    if kind == "h1":
        target = now.date() + timedelta(days=1)
        rows = (await db.execute(
            select(ClassSession).where(
                ClassSession.session_date == target,
                ClassSession.status == ClassSessionStatus.SCHEDULED,
            )
        )).scalars().all()
        return rows
    # h2: kelas yang mulai dalam (sekarang, sekarang + X jam]
    window_end = now + timedelta(hours=settings.REMINDER_HOURS_BEFORE)
    rows = (await db.execute(
        select(ClassSession).where(
            ClassSession.session_date.in_([now.date(), now.date() + timedelta(days=1)]),
            ClassSession.status == ClassSessionStatus.SCHEDULED,
        )
    )).scalars().all()
    return [s for s in rows if now < session_start_dt(s) <= window_end]


async def run_reminder_pass(db: AsyncSession, kind: str = "h1", force: bool = False) -> dict:
    if kind not in _KINDS:
        raise ValueError(f"kind harus salah satu {_KINDS}")
    col = "reminder_sent_at" if kind == "h1" else "reminder_2h_sent_at"
    compose = _compose_h1 if kind == "h1" else _compose_h2

    sessions = await _sessions_for(db, kind)
    results = {"kind": kind, "sent": 0, "skipped": 0, "failed": 0, "detail": []}
    if not sessions:
        return results

    for session in sessions:
        rows = (await db.execute(
            select(Booking, User)
            .join(User, Booking.member_id == User.id)
            .where(Booking.session_id == session.id, Booking.status == BookingStatus.BOOKED)
        )).all()
        for booking, member in rows:
            if getattr(booking, col) and not force:
                results["skipped"] += 1
                continue
            if not member.phone:
                results["skipped"] += 1
                results["detail"].append(f"{member.full_name}: tak ada nomor HP")
                continue
            ok, info = await send_whatsapp(member.phone, compose(member.full_name, session))
            if ok:
                setattr(booking, col, datetime.now(timezone.utc))
                results["sent"] += 1
            elif info.startswith("DRY-RUN"):
                results["skipped"] += 1
            else:
                results["failed"] += 1
            results["detail"].append(f"{member.full_name} ({member.phone}) → {info}")
    await db.flush()
    return results
