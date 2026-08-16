import uuid
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff
from app.models.user import User
from app.models.schedule import ClassSession, ClassSessionStatus
from app.models.booking import Booking, BookingStatus

router = APIRouter()


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
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    in_range = (ClassSession.session_date >= date_from) & (ClassSession.session_date <= date_to)

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
