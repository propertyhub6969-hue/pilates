"""Cari booking H-1 dan kirim pengingat WhatsApp. Idempoten via Booking.reminder_sent_at."""
from datetime import date, timedelta, datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.schedule import ClassSession, ClassSessionStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User
from app.services.whatsapp import send_whatsapp
from app.services.booking import now_local

DAY_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


def _compose(name: str, session: ClassSession) -> str:
    d = session.session_date
    hari = f"{DAY_ID[d.weekday()]}, {d.day}/{d.month}/{d.year}"
    jam = session.start_time.strftime("%H:%M")
    extra = ""
    if session.room:
        extra += f"\nRuang: {session.room}"
    first = (name or "Kak").split(" ")[0]
    return (
        f"Halo {first} 👋\n\n"
        f"Pengingat kelas *{session.title}* besok:\n"
        f"🗓️ {hari}\n⏰ {jam} WIB{extra}\n\n"
        f"Sampai jumpa di studio! 🧘\n"
        f"_Balas pesan ini bila berhalangan hadir agar slot bisa dipakai member lain._\n\n"
        f"— {settings.STUDIO_WA_SIGNATURE}"
    )


async def run_reminder_pass(db: AsyncSession, target_date: date | None = None, force: bool = False) -> dict:
    """Kirim reminder utk semua booking terkonfirmasi pada `target_date` (default: besok)."""
    if target_date is None:
        target_date = now_local().date() + timedelta(days=1)

    sessions = (
        await db.execute(
            select(ClassSession).where(
                ClassSession.session_date == target_date,
                ClassSession.status == ClassSessionStatus.SCHEDULED,
            )
        )
    ).scalars().all()

    results = {"target_date": target_date.isoformat(), "sent": 0, "skipped": 0, "failed": 0, "detail": []}
    if not sessions:
        return results

    for session in sessions:
        rows = (
            await db.execute(
                select(Booking, User)
                .join(User, Booking.member_id == User.id)
                .where(Booking.session_id == session.id, Booking.status == BookingStatus.BOOKED)
            )
        ).all()
        for booking, member in rows:
            if booking.reminder_sent_at and not force:
                results["skipped"] += 1
                continue
            if not member.phone:
                results["skipped"] += 1
                results["detail"].append(f"{member.full_name}: tak ada nomor HP")
                continue
            ok, info = await send_whatsapp(member.phone, _compose(member.full_name, session))
            if ok:
                booking.reminder_sent_at = datetime.now(timezone.utc)
                results["sent"] += 1
            elif info.startswith("DRY-RUN"):
                results["skipped"] += 1
            else:
                results["failed"] += 1
            results["detail"].append(f"{member.full_name} ({member.phone}) → {info}")
    await db.flush()
    return results
