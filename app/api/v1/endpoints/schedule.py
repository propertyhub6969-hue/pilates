import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, require_staff
from app.models.user import User, UserRole, MemberCategory
from app.models.schedule import ClassTemplate, ClassSession, ClassSessionStatus
from app.models.booking import Booking, BookingStatus
from app.models.package import MemberPackage
from app.models.branch import Branch
from app.schemas.common import Page
from app.schemas.schedule import (
    TemplateCreate, TemplateUpdate, TemplateResponse,
    GenerateRequest, GenerateResult,
    SessionCreate, SessionUpdate, SessionResponse, BookingRow, RescheduleRequest,
)
from app.services import booking as booking_svc
from app.services.quota import refresh_status, _now as _quota_now

router = APIRouter()

DOW = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


# ─────────────── TEMPLATE ───────────────
async def _instructor_names(db: AsyncSession, ids: set) -> dict:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    rows = (await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))).all()
    return {rid: name for rid, name in rows}


@router.get("/templates", response_model=Page[TemplateResponse])
async def list_templates(
    branch_id: uuid.UUID = Query(..., description="Cabang"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    rows = (
        await db.execute(
            select(ClassTemplate)
            .where(ClassTemplate.branch_id == branch_id)
            .order_by(ClassTemplate.day_of_week, ClassTemplate.start_time)
        )
    ).scalars().all()
    names = await _instructor_names(db, {t.instructor_id for t in rows})
    items = []
    for t in rows:
        r = TemplateResponse.model_validate(t)
        r.instructor_name = names.get(t.instructor_id)
        items.append(r)
    return Page(items=items, total=len(items))


@router.post("/templates", response_model=TemplateResponse, status_code=201)
async def create_template(payload: TemplateCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    await _validate_branch(db, payload.branch_id)
    await _validate_instructor(db, payload.instructor_id)
    tpl = ClassTemplate(**payload.model_dump())
    db.add(tpl)
    await db.flush()
    await db.refresh(tpl)
    return TemplateResponse.model_validate(tpl)


@router.patch("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: uuid.UUID, payload: TemplateUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    tpl = (await db.execute(select(ClassTemplate).where(ClassTemplate.id == template_id))).scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template tidak ditemukan")
    data = payload.model_dump(exclude_unset=True)
    if "instructor_id" in data:
        await _validate_instructor(db, data["instructor_id"])
    for k, v in data.items():
        setattr(tpl, k, v)
    await db.flush()
    await db.refresh(tpl)
    return TemplateResponse.model_validate(tpl)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    tpl = (await db.execute(select(ClassTemplate).where(ClassTemplate.id == template_id))).scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template tidak ditemukan")
    used = (await db.execute(select(func.count()).select_from(ClassSession).where(ClassSession.template_id == template_id))).scalar_one()
    if used:
        tpl.is_active = False  # arsipkan; sesi yang sudah dibuat tetap ada
    else:
        await db.delete(tpl)
    return None


async def _validate_instructor(db: AsyncSession, instructor_id):
    if not instructor_id:
        return
    u = (await db.execute(select(User).where(User.id == instructor_id))).scalar_one_or_none()
    if not u or u.role not in (UserRole.INSTRUCTOR, UserRole.OWNER, UserRole.ADMIN):
        raise HTTPException(400, "Instruktur tidak valid")


async def _validate_branch(db: AsyncSession, branch_id):
    b = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(400, "Cabang tidak valid")


@router.post("/generate", response_model=GenerateResult)
async def generate(payload: GenerateRequest, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    created, skipped = await booking_svc.generate_sessions(db, payload.weeks, branch_id=payload.branch_id)
    return GenerateResult(created=created, skipped=skipped)


# ─────────────── SESI ───────────────
async def _serialize_sessions(db: AsyncSession, rows, viewer: User) -> list[SessionResponse]:
    if not rows:
        return []
    ids = [s.id for s in rows]
    # hitung booked & waitlist per sesi
    counts = (
        await db.execute(
            select(Booking.session_id, Booking.status, func.count())
            .where(Booking.session_id.in_(ids))
            .group_by(Booking.session_id, Booking.status)
        )
    ).all()
    booked, waits = {}, {}
    for sid, status, c in counts:
        if status == BookingStatus.BOOKED:
            booked[sid] = c
        elif status == BookingStatus.WAITLIST:
            waits[sid] = c
    # jumlah booking bulanan per sesi (utk deteksi "sesi sepi")
    bul_rows = (
        await db.execute(
            select(Booking.session_id, func.count())
            .join(User, Booking.member_id == User.id)
            .where(Booking.session_id.in_(ids), Booking.status == BookingStatus.BOOKED,
                   User.member_category == MemberCategory.BULANAN)
            .group_by(Booking.session_id)
        )
    ).all()
    bulanan = {sid: c for sid, c in bul_rows}
    names = await _instructor_names(db, {s.instructor_id for s in rows})
    # nama cabang
    bids = {s.branch_id for s in rows}
    branch_names = {
        bid: name for bid, name in (
            await db.execute(select(Branch.id, Branch.name).where(Branch.id.in_(bids)))
        ).all()
    }
    # booking milik viewer (member) pada sesi-sesi ini
    mine = {}
    if viewer.role == UserRole.MEMBER:
        mrows = (
            await db.execute(
                select(Booking).where(
                    Booking.session_id.in_(ids), Booking.member_id == viewer.id,
                    Booking.status.in_([BookingStatus.BOOKED, BookingStatus.WAITLIST, BookingStatus.ATTENDED]),
                )
            )
        ).scalars().all()
        mine = {b.session_id: b for b in mrows}

    # Jendela booking utk kategori pemanggil (member) — non-member pakai jendela "member"
    studio = await booking_svc.get_studio(db)
    now = booking_svc.now_local()
    viewer_cat = viewer.member_category if viewer.role == UserRole.MEMBER else None

    out = []
    for s in rows:
        r = SessionResponse.model_validate(s)
        r.instructor_name = names.get(s.instructor_id)
        r.branch_name = branch_names.get(s.branch_id)
        bc = booked.get(s.id, 0)
        r.booked_count = bc
        r.waitlist_count = waits.get(s.id, 0)
        r.slots_remaining = max(0, s.capacity - bc)
        b = mine.get(s.id)
        if b:
            r.my_booking_status = b.status
            r.my_booking_id = b.id

        r.bulanan_count = bulanan.get(s.id, 0)
        r.is_underfilled = (
            s.status == ClassSessionStatus.SCHEDULED
            and s.session_date >= date.today()
            and r.bulanan_count < (studio.min_bulanan or 0)
        )
        if s.status != ClassSessionStatus.SCHEDULED:
            r.booking_state = "cancelled"
            r.can_book = False
        else:
            opens = booking_svc.booking_open_dt(studio, s, viewer_cat)
            closes = booking_svc.booking_close_dt(studio, s)
            r.booking_opens_at = opens
            r.booking_closes_at = closes
            if now >= closes:
                r.booking_state = "closed"
            elif now < opens:
                r.booking_state = "not_open"
            elif r.slots_remaining <= 0:
                r.booking_state = "full"
            else:
                r.booking_state = "open"
            r.can_book = r.booking_state in ("open", "full")
        out.append(r)
    return out


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    date_from: date = Query(default_factory=date.today, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    branch_id: uuid.UUID | None = Query(None, description="Filter cabang"),
    mine: bool = Query(False, description="Member: hanya sesi yang saya booking"),
    db: AsyncSession = Depends(get_db),
    viewer: User = Depends(get_current_user),
):
    if date_to is None:
        date_to = date_from + timedelta(days=14)
    stmt = select(ClassSession).where(
        ClassSession.session_date >= date_from, ClassSession.session_date <= date_to
    )
    if branch_id is not None:
        stmt = stmt.where(ClassSession.branch_id == branch_id)
    # Member hanya lihat sesi terjadwal (bukan yg dibatalkan), kecuali minta punyanya
    if viewer.role == UserRole.MEMBER and not mine:
        stmt = stmt.where(ClassSession.status == ClassSessionStatus.SCHEDULED)
    stmt = stmt.order_by(ClassSession.session_date, ClassSession.start_time)
    rows = (await db.execute(stmt)).scalars().all()

    if mine and viewer.role == UserRole.MEMBER:
        booked_ids = set((
            await db.execute(
                select(Booking.session_id).where(
                    Booking.member_id == viewer.id,
                    Booking.status.in_([BookingStatus.BOOKED, BookingStatus.WAITLIST, BookingStatus.ATTENDED]),
                )
            )
        ).scalars().all())
        rows = [s for s in rows if s.id in booked_ids]

    return await _serialize_sessions(db, rows, viewer)


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(payload: SessionCreate, db: AsyncSession = Depends(get_db), staff: User = Depends(require_staff)):
    await _validate_branch(db, payload.branch_id)
    await _validate_instructor(db, payload.instructor_id)
    s = ClassSession(**payload.model_dump(), status=ClassSessionStatus.SCHEDULED)
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return (await _serialize_sessions(db, [s], staff))[0]


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(session_id: uuid.UUID, payload: SessionUpdate, db: AsyncSession = Depends(get_db), staff: User = Depends(require_staff)):
    s = (await db.execute(select(ClassSession).where(ClassSession.id == session_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sesi tidak ditemukan")
    data = payload.model_dump(exclude_unset=True)
    if data.get("instructor_id"):
        await _validate_instructor(db, data["instructor_id"])
    for k, v in data.items():
        setattr(s, k, v)
    await db.flush()
    await db.refresh(s)
    return (await _serialize_sessions(db, [s], staff))[0]


@router.post("/sessions/{session_id}/cancel", response_model=SessionResponse)
async def cancel_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db), staff: User = Depends(require_staff)):
    """Batalkan sesi (mis. instruktur berhalangan). Kuota SEMUA peserta booked dikembalikan."""
    s = (await db.execute(select(ClassSession).where(ClassSession.id == session_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sesi tidak ditemukan")
    bookings = (
        await db.execute(select(Booking).where(
            Booking.session_id == session_id,
            Booking.status.in_([BookingStatus.BOOKED, BookingStatus.WAITLIST]),
        ))
    ).scalars().all()
    from app.models.payment import Payment, PaymentStatus
    for b in bookings:
        if b.status == BookingStatus.BOOKED and b.member_package_id:
            mp = (await db.execute(select(MemberPackage).where(MemberPackage.id == b.member_package_id))).scalar_one_or_none()
            if mp and not mp.is_unlimited and mp.sessions_remaining is not None:
                mp.sessions_remaining += 1
                refresh_status(mp)
        elif b.member_package_id is None:
            # drop-in → hapus/refund tagihannya
            for p in (await db.execute(select(Payment).where(Payment.booking_id == b.id))).scalars().all():
                if p.status == PaymentStatus.PENDING:
                    await db.delete(p)
                elif p.status == PaymentStatus.PAID:
                    p.status = PaymentStatus.REFUNDED
        b.status = BookingStatus.CANCELLED
        b.cancelled_at = _quota_now()
        b.member_package_id = None
    s.status = ClassSessionStatus.CANCELLED
    await db.flush()
    await db.refresh(s)
    return (await _serialize_sessions(db, [s], staff))[0]


async def _notify_reschedule(db: AsyncSession, session: ClassSession, old_date, old_time) -> int:
    """Kirim WA ke peserta terdaftar (booked+waitlist) bahwa sesi dijadwalkan ulang. Best-effort."""
    from app.services.whatsapp import send_whatsapp
    from app.models.studio import StudioSettings
    studio = (await db.execute(select(StudioSettings))).scalars().first()
    sname = studio.name if studio else "Reformer Your Body"
    rows = (
        await db.execute(
            select(User.full_name, User.phone)
            .join(Booking, Booking.member_id == User.id)
            .where(Booking.session_id == session.id,
                   Booking.status.in_([BookingStatus.BOOKED, BookingStatus.WAITLIST]),
                   User.phone.isnot(None))
        )
    ).all()
    def fmt(d, t):
        return f"{d.strftime('%d/%m/%Y')} {t.strftime('%H:%M')}"
    sent = 0
    for name, phone in rows:
        msg = (
            f"Halo {name}, kelas *{session.title}* DIJADWALKAN ULANG.\n"
            f"Semula: {fmt(old_date, old_time)} WITA\n"
            f"Menjadi: *{fmt(session.session_date, session.start_time)} WITA*\n\n"
            f"Bookingmu otomatis ikut pindah. Cek aplikasi untuk detail. Terima kasih 🙏\n{sname}"
        )
        try:
            ok, _ = await send_whatsapp(phone, msg)
            if ok:
                sent += 1
        except Exception:  # noqa: BLE001
            pass
    return sent


@router.post("/sessions/{session_id}/reschedule", response_model=SessionResponse)
async def reschedule_session(
    session_id: uuid.UUID,
    payload: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Pindahkan sesi ke tanggal/jam lain. Booking peserta ikut pindah (tetap terpasang).
    Jendela booking otomatis dihitung ulang dari tanggal baru. Opsional: beri tahu peserta via WA."""
    s = (await db.execute(select(ClassSession).where(ClassSession.id == session_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sesi tidak ditemukan")
    if s.status != ClassSessionStatus.SCHEDULED:
        raise HTTPException(400, "Hanya sesi terjadwal yang bisa dijadwalkan ulang")
    old_date, old_time = s.session_date, s.start_time
    s.session_date = payload.session_date
    s.start_time = payload.start_time
    await db.flush()
    if payload.notify:
        try:
            await _notify_reschedule(db, s, old_date, old_time)
        except Exception:  # noqa: BLE001
            pass
    await db.refresh(s)
    return (await _serialize_sessions(db, [s], staff))[0]


@router.get("/sessions/{session_id}/roster", response_model=list[BookingRow])
async def session_roster(session_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    rows = (
        await db.execute(
            select(Booking, User.full_name)
            .join(User, Booking.member_id == User.id)
            .where(Booking.session_id == session_id)
            .order_by(Booking.status, Booking.waitlist_position.asc().nulls_first(), Booking.booked_at)
        )
    ).all()
    out = []
    for b, name in rows:
        r = BookingRow.model_validate(b)
        r.member_name = name
        out.append(r)
    return out
