import uuid
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff
from app.models.user import User, UserRole
from app.models.schedule import ClassSession, ClassSessionStatus
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus

router = APIRouter()


class TodaySession(BaseModel):
    id: uuid.UUID
    title: str
    start_time: str
    booked_count: int
    capacity: int
    status: ClassSessionStatus


class DashboardSummary(BaseModel):
    members_active: int
    revenue_month: Optional[float] = None  # None utk non-owner (report hanya owner)
    payments_pending: int
    attendance_rate_30d: float
    today_sessions: List[TodaySession]


@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard(
    branch_id: uuid.UUID | None = Query(None, description="Filter kelas hari ini per cabang"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    from app.services.booking import today_local
    today = today_local()
    month_start = today.replace(day=1)

    members_active = (
        await db.execute(
            select(func.count()).select_from(User).where(
                User.role == UserRole.MEMBER, User.is_active.is_(True)
            )
        )
    ).scalar_one()

    revenue_month = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.status == PaymentStatus.PAID, Payment.created_at >= month_start
            )
        )
    ).scalar_one()

    payments_pending = (
        await db.execute(
            select(func.count()).select_from(Payment).where(Payment.status == PaymentStatus.PENDING)
        )
    ).scalar_one()

    # Tingkat kehadiran 30 hari terakhir
    since = today - timedelta(days=30)
    att = dict((s, c) for s, c in (
        await db.execute(
            select(Booking.status, func.count())
            .join(ClassSession, Booking.session_id == ClassSession.id)
            .where(ClassSession.session_date >= since, ClassSession.session_date <= today)
            .group_by(Booking.status)
        )
    ).all())
    a, n = att.get(BookingStatus.ATTENDED, 0), att.get(BookingStatus.NO_SHOW, 0)
    rate = round(a / (a + n), 3) if (a + n) else 0.0

    # Kelas hari ini + jumlah booked (opsional per cabang)
    sess_stmt = select(ClassSession).where(ClassSession.session_date == today)
    if branch_id is not None:
        sess_stmt = sess_stmt.where(ClassSession.branch_id == branch_id)
    sessions = (await db.execute(sess_stmt.order_by(ClassSession.start_time))).scalars().all()
    booked = {}
    if sessions:
        for sid, c in (
            await db.execute(
                select(Booking.session_id, func.count())
                .where(Booking.session_id.in_([s.id for s in sessions]), Booking.status == BookingStatus.BOOKED)
                .group_by(Booking.session_id)
            )
        ).all():
            booked[sid] = c
    today_sessions = [
        TodaySession(
            id=s.id, title=s.title, start_time=s.start_time.strftime("%H:%M"),
            booked_count=booked.get(s.id, 0), capacity=s.capacity, status=s.status,
        )
        for s in sessions
    ]

    # Angka pendapatan hanya untuk owner ("report hanya owner")
    revenue_visible = float(revenue_month or 0) if actor.role == UserRole.OWNER else None

    return DashboardSummary(
        members_active=members_active,
        revenue_month=revenue_visible,
        payments_pending=payments_pending,
        attendance_rate_30d=rate,
        today_sessions=today_sessions,
    )


class MemberAttendance(BaseModel):
    member_id: uuid.UUID
    member_name: str
    attended: int
    no_show: int


class AttendanceReport(BaseModel):
    date_from: date
    date_to: date
    sessions_total: int
    sessions_cancelled: int
    attended: int
    no_show: int
    booked_open: int          # masih terdaftar & belum diabsen
    attendance_rate: float    # attended / (attended + no_show)
    top_members: List[MemberAttendance]


@router.get("/attendance", response_model=AttendanceReport)
async def attendance_report(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    branch_id: uuid.UUID | None = Query(None, description="Filter cabang"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    in_range = (ClassSession.session_date >= date_from) & (ClassSession.session_date <= date_to)
    if branch_id is not None:
        in_range = in_range & (ClassSession.branch_id == branch_id)

    sessions_total = (await db.execute(select(func.count()).select_from(ClassSession).where(in_range))).scalar_one()
    sessions_cancelled = (
        await db.execute(select(func.count()).select_from(ClassSession).where(in_range, ClassSession.status == ClassSessionStatus.CANCELLED))
    ).scalar_one()

    # Hitung booking per status utk sesi dalam rentang
    status_counts = dict((s, c) for s, c in (
        await db.execute(
            select(Booking.status, func.count())
            .join(ClassSession, Booking.session_id == ClassSession.id)
            .where(in_range)
            .group_by(Booking.status)
        )
    ).all())
    attended = status_counts.get(BookingStatus.ATTENDED, 0)
    no_show = status_counts.get(BookingStatus.NO_SHOW, 0)
    booked_open = status_counts.get(BookingStatus.BOOKED, 0)
    denom = attended + no_show
    rate = round(attended / denom, 3) if denom else 0.0

    # Per member (top berdasarkan kehadiran)
    rows = (
        await db.execute(
            select(
                Booking.member_id, User.full_name,
                func.count().filter(Booking.status == BookingStatus.ATTENDED).label("attended"),
                func.count().filter(Booking.status == BookingStatus.NO_SHOW).label("no_show"),
            )
            .join(ClassSession, Booking.session_id == ClassSession.id)
            .join(User, Booking.member_id == User.id)
            .where(in_range, Booking.status.in_([BookingStatus.ATTENDED, BookingStatus.NO_SHOW]))
            .group_by(Booking.member_id, User.full_name)
            .order_by(func.count().filter(Booking.status == BookingStatus.ATTENDED).desc())
            .limit(15)
        )
    ).all()
    top = [MemberAttendance(member_id=mid, member_name=name, attended=a, no_show=n) for mid, name, a, n in rows]

    return AttendanceReport(
        date_from=date_from, date_to=date_to,
        sessions_total=sessions_total, sessions_cancelled=sessions_cancelled,
        attended=attended, no_show=no_show, booked_open=booked_open,
        attendance_rate=rate, top_members=top,
    )
