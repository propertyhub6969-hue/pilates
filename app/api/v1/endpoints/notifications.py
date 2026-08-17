from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff
from app.models.user import User, UserRole
from app.models.payment import Payment, PaymentStatus
from app.models.booking import Booking, BookingStatus
from app.models.schedule import ClassSession

router = APIRouter()


class NotifItem(BaseModel):
    id: str
    type: str        # 'proof' | 'payment' | 'booking' | 'member'
    title: str
    subtitle: str
    time: datetime
    link: str


def _rp(v) -> str:
    return f"Rp{int(float(v or 0)):,}".replace(",", ".")


@router.get("", response_model=list[NotifItem])
async def list_notifications(db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    now = datetime.now(timezone.utc)
    day1 = now - timedelta(days=1)
    day2 = now - timedelta(days=2)
    items: list[NotifItem] = []

    # 1) Pembayaran pending (bukti masuk = perlu verifikasi; tanpa bukti = menunggu bayar)
    pay_rows = (
        await db.execute(
            select(Payment, User.full_name)
            .join(User, Payment.member_id == User.id)
            .where(Payment.status == PaymentStatus.PENDING)
            .order_by(Payment.created_at.desc()).limit(20)
        )
    ).all()
    for p, name in pay_rows:
        if p.proof_path:
            items.append(NotifItem(id=f"proof-{p.id}", type="proof", title="Bukti transfer masuk",
                                   subtitle=f"{name} · {_rp(p.amount)} — perlu verifikasi", time=p.created_at, link="/pembayaran"))
        else:
            items.append(NotifItem(id=f"pay-{p.id}", type="payment", title="Pembayaran menunggu",
                                   subtitle=f"{name} · {_rp(p.amount)}", time=p.created_at, link="/pembayaran"))

    # 2) Booking baru (24 jam terakhir)
    bk_rows = (
        await db.execute(
            select(Booking, User.full_name, ClassSession.title, ClassSession.session_date)
            .join(User, Booking.member_id == User.id)
            .join(ClassSession, Booking.session_id == ClassSession.id)
            .where(Booking.booked_at >= day1, Booking.status.in_([BookingStatus.BOOKED, BookingStatus.WAITLIST]))
            .order_by(Booking.booked_at.desc()).limit(12)
        )
    ).all()
    for b, name, title, sdate in bk_rows:
        items.append(NotifItem(id=f"book-{b.id}", type="booking", title="Booking baru",
                              subtitle=f"{name} · {title} ({sdate.day}/{sdate.month})", time=b.booked_at, link="/jadwal"))

    # 3) Member baru (48 jam terakhir)
    mem_rows = (
        await db.execute(
            select(User).where(User.role == UserRole.MEMBER, User.created_at >= day2)
            .order_by(User.created_at.desc()).limit(12)
        )
    ).scalars().all()
    for u in mem_rows:
        items.append(NotifItem(id=f"member-{u.id}", type="member", title="Member baru",
                              subtitle=f"{u.full_name} mendaftar", time=u.created_at, link="/member"))

    items.sort(key=lambda x: x.time, reverse=True)
    return items[:25]
