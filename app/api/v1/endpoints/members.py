import uuid
from datetime import datetime, timezone, timedelta, time as dtime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.deps import get_current_user, require_staff, require_owner
from app.models.user import User, UserRole, MemberCategory
from app.models.package import Package, MemberPackage, MemberPackageStatus, SessionAdjustment
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.schemas.common import Page
from app.schemas.member import (
    UserCreate, UserUpdate, UserBrief, MemberDetail,
    MemberPackageResponse, PaymentResponse, PurchaseCreate, EnrollRequest, DropinTicketCreate,
    PackageUsageRow, UpgradeRequest, SessionAdjustRequest, SessionAdjustmentRow, PackageEditRequest,
    GrantSessionsRequest, MemberBuyRequest,
)
from app.models.schedule import ClassSession
from app.models.booking import Booking, BookingStatus
from app.schemas.auth import SetPassword
from app.services.quota import refresh_status, is_usable
from app.services.whatsapp import phone_taken

router = APIRouter()


def _can_manage_role(actor: User, target_role: UserRole) -> None:
    """Owner boleh buat siapa saja kecuali owner lain; admin hanya member & instruktur."""
    if target_role == UserRole.OWNER:
        raise HTTPException(400, "Tidak bisa membuat akun owner dari sini")
    if target_role == UserRole.ADMIN and actor.role != UserRole.OWNER:
        raise HTTPException(403, "Hanya owner yang bisa menambah admin")


@router.get("", response_model=Page[UserBrief])
async def list_users(
    role: UserRole | None = Query(None, description="Filter peran (mis. member/instructor)"),
    category: MemberCategory | None = Query(None, description="Filter kategori member"),
    package_name: str | None = Query(None, description="Filter member yang pegang paket AKTIF bernama ini (abaikan huruf besar/kecil)"),
    q: str | None = Query(None, description="Cari nama/email/telepon"),
    active_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role)
    if category:
        stmt = stmt.where(User.member_category == category)
    if package_name == "__none__":
        # Member yang belum punya paket sama sekali
        stmt = stmt.where(User.role == UserRole.MEMBER, ~User.id.in_(select(MemberPackage.member_id)))
    elif package_name:
        stmt = stmt.where(User.id.in_(
            select(MemberPackage.member_id).where(
                func.lower(MemberPackage.package_name) == package_name.strip().lower(),
                MemberPackage.status == MemberPackageStatus.ACTIVE,
            )
        ))
    if active_only:
        stmt = stmt.where(User.is_active.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(User.full_name.asc()).limit(limit).offset(offset))
    ).scalars().all()

    # Ringkasan kuota + status sesi + kedaluwarsa utk member yang tampil di halaman ini
    member_ids = [u.id for u in rows if u.role == UserRole.MEMBER]
    quota: dict = {}
    if member_ids:
        mps = (
            await db.execute(select(MemberPackage).where(MemberPackage.member_id.in_(member_ids)))
        ).scalars().all()
        by_member: dict = {}
        for mp in mps:
            by_member.setdefault(mp.member_id, []).append(mp)
        now = datetime.now(timezone.utc)
        far = datetime.max.replace(tzinfo=timezone.utc)
        for mid, pkgs in by_member.items():
            usable = [mp for mp in pkgs if is_usable(mp)]
            has_unl = any(mp.is_unlimited for mp in usable)
            remaining = None if has_unl else sum((mp.sessions_remaining or 0) for mp in usable)
            # paket "utama": usable yang paling cepat kedaluwarsa; kalau tak ada, paket terbaru
            if usable:
                primary = min(usable, key=lambda mp: (mp.expires_at or far))
                if not primary.is_unlimited and 0 < (primary.sessions_remaining or 0) <= 2:
                    status = "almost_out"
                else:
                    status = "active"
            elif pkgs:
                primary = max(pkgs, key=lambda mp: mp.purchased_at)
                if primary.status == MemberPackageStatus.EXPIRED or (primary.expires_at and primary.expires_at < now):
                    status = "expired"
                elif not primary.is_unlimited and (primary.sessions_remaining or 0) <= 0:
                    status = "used_up"
                else:
                    status = primary.status.value
            else:
                primary, status = None, "none"
            quota[mid] = (remaining, has_unl, status, primary.expires_at if primary else None)

    items = []
    for u in rows:
        brief = UserBrief.model_validate(u)
        if u.id in quota:
            brief.active_sessions_remaining, brief.has_unlimited, brief.session_status, brief.package_expires_at = quota[u.id]
        elif u.role == UserRole.MEMBER:
            brief.session_status = "none"
        items.append(brief)
    return Page(items=items, total=total)


@router.get("/package-names")
async def package_names(db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    """Daftar nama paket AKTIF yang sedang dipegang member (dikelompokkan tanpa peduli huruf
    besar/kecil) + jumlah member — untuk dropdown filter."""
    rows = (
        await db.execute(
            select(
                func.min(MemberPackage.package_name).label("name"),
                func.count(func.distinct(MemberPackage.member_id)).label("count"),
            )
            .where(MemberPackage.status == MemberPackageStatus.ACTIVE)
            .group_by(func.lower(MemberPackage.package_name))
            .order_by(func.count(func.distinct(MemberPackage.member_id)).desc())
        )
    ).all()
    out = [{"name": n, "count": c} for n, c in rows]
    # Opsi khusus: member yang belum punya paket sama sekali
    none_count = (
        await db.execute(
            select(func.count()).select_from(User).where(
                User.role == UserRole.MEMBER, ~User.id.in_(select(MemberPackage.member_id))
            )
        )
    ).scalar_one()
    if none_count:
        out.append({"name": "__none__", "label": "Belum ada paket", "count": none_count})
    return out


@router.post("", response_model=UserBrief, status_code=201)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    _can_manage_role(actor, payload.role)
    exists = (await db.execute(select(User).where(User.email == payload.email.lower()))).scalar_one_or_none()
    if exists:
        raise HTTPException(400, "Email sudah terdaftar")
    if payload.phone and await phone_taken(db, payload.phone):
        raise HTTPException(400, "Nomor WhatsApp sudah terdaftar")
    data = payload.model_dump(exclude={"password"})
    data["email"] = payload.email.lower()
    user = User(**data, hashed_password=get_password_hash(payload.password))
    if user.role == UserRole.MEMBER and user.join_date is None:
        user.join_date = datetime.now(timezone.utc).date()
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _load_detail(db: AsyncSession, user: User) -> MemberDetail:
    packages = (
        await db.execute(
            select(MemberPackage)
            .where(MemberPackage.member_id == user.id)
            .order_by(MemberPackage.purchased_at.desc())
        )
    ).scalars().all()
    for mp in packages:
        refresh_status(mp)  # perbarui status kedaluwarsa/habis saat dibaca

    payments = (
        await db.execute(
            select(Payment).where(Payment.member_id == user.id).order_by(Payment.created_at.desc()).limit(50)
        )
    ).scalars().all()

    usable = [mp for mp in packages if is_usable(mp)]
    has_unlimited = any(mp.is_unlimited for mp in usable)
    remaining = None if has_unlimited else sum((mp.sessions_remaining or 0) for mp in usable)

    detail = MemberDetail.model_validate(user)
    detail.packages = [MemberPackageResponse.model_validate(mp) for mp in packages]
    pay_list = []
    for p in payments:
        pr = PaymentResponse.model_validate(p)
        pr.has_proof = bool(p.proof_path)
        pay_list.append(pr)
    detail.payments = pay_list
    detail.active_sessions_remaining = remaining
    detail.has_unlimited = has_unlimited
    return detail


@router.get("/counts")
async def member_counts(db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    """Jumlah member per kategori + instruktur, utk badge di tab."""
    rows = (
        await db.execute(
            select(User.member_category, func.count())
            .where(User.role == UserRole.MEMBER)
            .group_by(User.member_category)
        )
    ).all()
    out = {"all": 0, "bulanan": 0, "private": 0, "per_datang": 0}
    for cat, c in rows:
        out["all"] += c
        if cat is not None:
            out[cat.value] = c
    out["instructor"] = (
        await db.execute(select(func.count()).select_from(User).where(User.role == UserRole.INSTRUCTOR))
    ).scalar_one()
    return out


@router.get("/packages/{mp_id}/usage", response_model=list[PackageUsageRow])
async def package_usage(mp_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    """Riwayat pemakaian sesi dari sebuah paket — booking yang menahan/memakai kuota paket ini."""
    rows = (
        await db.execute(
            select(ClassSession.session_date, ClassSession.start_time, ClassSession.title, Booking.status, Booking.booked_at)
            .join(Booking, Booking.session_id == ClassSession.id)
            .where(
                Booking.member_package_id == mp_id,
                Booking.status.in_([BookingStatus.BOOKED, BookingStatus.ATTENDED, BookingStatus.NO_SHOW]),
            )
            .order_by(ClassSession.session_date.desc(), ClassSession.start_time.desc())
        )
    ).all()
    return [PackageUsageRow(session_date=d, start_time=t, title=ti, status=s, booked_at=ba) for d, t, ti, s, ba in rows]


@router.post("/packages/{mp_id}/adjust-sessions", response_model=MemberPackageResponse)
async def adjust_sessions(mp_id: uuid.UUID, payload: SessionAdjustRequest, db: AsyncSession = Depends(get_db), actor: User = Depends(require_owner)):
    """Admin menambah/mengurangi sisa sesi paket (delta +/-), dicatat di riwayat."""
    mp = (await db.execute(select(MemberPackage).where(MemberPackage.id == mp_id))).scalar_one_or_none()
    if not mp:
        raise HTTPException(404, "Paket member tidak ditemukan")
    if mp.is_unlimited:
        raise HTTPException(400, "Paket unlimited tak punya jumlah sesi untuk disesuaikan")
    if payload.delta == 0:
        raise HTTPException(400, "Jumlah penyesuaian tidak boleh 0")

    before = mp.sessions_remaining or 0
    after = max(0, before + payload.delta)
    mp.sessions_remaining = after
    if (mp.sessions_total or 0) < after:
        mp.sessions_total = after  # kalau ditambah melebihi total, total ikut naik (X ≤ Y)
    refresh_status(mp)
    db.add(SessionAdjustment(
        member_package_id=mp.id, delta=payload.delta,
        before_remaining=before, after_remaining=after,
        reason=(payload.reason or None), adjusted_by_id=actor.id, adjusted_by_name=actor.full_name,
    ))
    await db.flush()
    await db.refresh(mp)
    return mp


@router.post("/{user_id}/grant-sessions", response_model=MemberDetail, status_code=201)
async def grant_sessions(user_id: uuid.UUID, payload: GrantSessionsRequest, db: AsyncSession = Depends(get_db), actor: User = Depends(require_owner)):
    """Beri saldo sesi langsung ke member tanpa mencatat penjualan (mis. koreksi data impor).
    Membuat paket baru harga Rp0, tercatat di riwayat penyesuaian."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or user.role != UserRole.MEMBER:
        raise HTTPException(404, "Member tidak ditemukan")
    exp = datetime.combine(payload.expires_at, dtime(23, 59), tzinfo=timezone.utc) if payload.expires_at else None
    mp = MemberPackage(
        member_id=user.id, package_id=None,
        package_name=(payload.label or "").strip() or "Sesi (pemberian admin)",
        is_unlimited=False, monthly_expiry=False,
        sessions_total=payload.sessions, sessions_remaining=payload.sessions,
        price_paid=0, purchased_at=datetime.now(timezone.utc), expires_at=exp,
        status=MemberPackageStatus.ACTIVE,
    )
    db.add(mp)
    await db.flush()
    db.add(SessionAdjustment(
        member_package_id=mp.id, delta=payload.sessions, before_remaining=0, after_remaining=payload.sessions,
        reason="pemberian sesi langsung (tanpa jual paket)", adjusted_by_id=actor.id, adjusted_by_name=actor.full_name,
    ))
    await db.flush()
    return await _load_detail(db, user)


@router.patch("/packages/{mp_id}", response_model=MemberPackageResponse)
async def edit_package(mp_id: uuid.UUID, payload: PackageEditRequest, db: AsyncSession = Depends(get_db), actor: User = Depends(require_owner)):
    """Admin ubah tanggal kedaluwarsa & jumlah sesi paket member langsung.
    Perubahan sisa sesi tetap dicatat di riwayat penyesuaian."""
    mp = (await db.execute(select(MemberPackage).where(MemberPackage.id == mp_id))).scalar_one_or_none()
    if not mp:
        raise HTTPException(404, "Paket member tidak ditemukan")
    data = payload.model_dump(exclude_unset=True)

    if "expires_at" in data:
        d = data["expires_at"]
        mp.expires_at = datetime.combine(d, dtime(23, 59), tzinfo=timezone.utc) if d else None

    if not mp.is_unlimited:
        if "sessions_total" in data and data["sessions_total"] is not None:
            mp.sessions_total = max(0, data["sessions_total"])
        if "sessions_remaining" in data and data["sessions_remaining"] is not None:
            before = mp.sessions_remaining or 0
            after = max(0, data["sessions_remaining"])
            if after != before:
                mp.sessions_remaining = after
                db.add(SessionAdjustment(
                    member_package_id=mp.id, delta=after - before,
                    before_remaining=before, after_remaining=after,
                    reason="set manual (edit paket)", adjusted_by_id=actor.id, adjusted_by_name=actor.full_name,
                ))
        # jaga total ≥ sisa
        if (mp.sessions_total or 0) < (mp.sessions_remaining or 0):
            mp.sessions_total = mp.sessions_remaining

    refresh_status(mp)
    await db.flush()
    await db.refresh(mp)
    return mp


@router.get("/packages/{mp_id}/adjustments", response_model=list[SessionAdjustmentRow])
async def package_adjustments(mp_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    """Riwayat penyesuaian sisa sesi (oleh admin) untuk sebuah paket."""
    rows = (
        await db.execute(
            select(SessionAdjustment).where(SessionAdjustment.member_package_id == mp_id)
            .order_by(SessionAdjustment.created_at.desc())
        )
    ).scalars().all()
    return rows


@router.get("/staff", response_model=list[UserBrief])
async def list_staff(db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    """Daftar pengguna sistem (owner/admin/instruktur) — hanya owner."""
    rows = (
        await db.execute(
            select(User).where(User.role.in_([UserRole.OWNER, UserRole.ADMIN, UserRole.INSTRUCTOR]))
            .order_by(User.role, User.full_name)
        )
    ).scalars().all()
    return rows


@router.get("/me", response_model=MemberDetail)
async def my_detail(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detail milik sendiri (paket & saldo kuota) — dipakai member dari HP."""
    return await _load_detail(db, user)


@router.post("/me/enroll", response_model=MemberDetail)
async def enroll_me(
    payload: EnrollRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aktivasi keanggotaan mandiri dari dashboard member: set kategori + (opsional) beli paket.
    Paket dibuat FROZEN + tagihan PENDING → aktif setelah admin verifikasi pembayaran."""
    if user.role != UserRole.MEMBER:
        raise HTTPException(403, "Hanya untuk member")
    user.member_category = payload.member_category
    await db.flush()
    if payload.package_id is not None:
        from app.services.purchase import create_purchase
        await create_purchase(
            db, member_id=user.id, package_id=payload.package_id,
            method=PaymentMethod.TRANSFER, mark_paid=False, activate=False,
            note="Aktivasi keanggotaan (menunggu pembayaran)",
        )
    elif payload.member_category == MemberCategory.PER_DATANG:
        # Per datang: buat TIKET drop-in pertama (paket 1 sesi FROZEN + tagihan PENDING).
        # Aktif setelah bukti transfer diverifikasi admin; dipakai saat booking.
        from app.services.purchase import create_dropin_ticket
        await create_dropin_ticket(db, member_id=user.id, method=PaymentMethod.TRANSFER, mark_paid=False)
    return await _load_detail(db, user)


@router.post("/me/buy-package", response_model=MemberDetail)
async def buy_package_me(payload: MemberBuyRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Member perpanjang/ambil paket sendiri (self-serve): paket FROZEN + tagihan PENDING,
    aktif setelah bukti transfer diverifikasi admin. Diskon perpanjangan otomatis diterapkan."""
    if user.role != UserRole.MEMBER:
        raise HTTPException(403, "Hanya untuk member")
    pkg = (await db.execute(
        select(Package).where(Package.id == payload.package_id, Package.is_active.is_(True))
    )).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")
    from app.services.purchase import create_purchase, price_quote
    quote = await price_quote(db, user.id, pkg)  # terapkan diskon perpanjangan / harga upgrade bila berhak
    await create_purchase(
        db, member_id=user.id, package_id=payload.package_id,
        method=PaymentMethod.TRANSFER, mark_paid=False, activate=False, price_paid=quote["total"],
        note="Perpanjang/ambil paket (menunggu pembayaran)",
    )
    return await _load_detail(db, user)


@router.get("/me/package-quotes")
async def my_package_quotes(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Harga efektif tiap paket aktif untuk member ini (diskon perpanjangan / harga upgrade sudah dihitung)."""
    if user.role != UserRole.MEMBER:
        raise HTTPException(403, "Hanya untuk member")
    from app.services.purchase import price_quote
    pkgs = (await db.execute(
        select(Package).where(Package.is_active.is_(True)).order_by(Package.price.asc())
    )).scalars().all()
    out = []
    for pkg in pkgs:
        q = await price_quote(db, user.id, pkg)
        out.append({
            "package_id": str(pkg.id), "name": pkg.name, "description": pkg.description,
            "is_unlimited": pkg.is_unlimited, "session_count": pkg.session_count,
            "base_price": q["base_price"], "total": q["total"],
            "renewal_discount": q["renewal_discount"], "kind": q["kind"],
        })
    return out


@router.post("/me/dropin-ticket", response_model=MemberDetail)
async def buy_dropin_ticket(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Member per-datang beli tiket drop-in 1 sesi (self-serve): tiket FROZEN + tagihan PENDING,
    aktif setelah bukti transfer diverifikasi admin."""
    if user.role != UserRole.MEMBER:
        raise HTTPException(403, "Hanya untuk member")
    from app.services.purchase import create_dropin_ticket
    await create_dropin_ticket(db, member_id=user.id, method=PaymentMethod.TRANSFER, mark_paid=False)
    return await _load_detail(db, user)


@router.get("/me/upgrade-options")
async def my_upgrade_options(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Paket yang bisa di-upgrade member ini (harga upgrade), hanya bila memenuhi syarat
    (sudah pernah bayar & belum pegang paket itu)."""
    if user.role != UserRole.MEMBER:
        return []
    from app.services.purchase import eligible_upgrade
    pkgs = (await db.execute(
        select(Package).where(Package.is_active.is_(True), Package.upgrade_price > 0)
        .order_by(Package.price)
    )).scalars().all()
    out = []
    for p in pkgs:
        if await eligible_upgrade(db, user.id, p):
            out.append({
                "id": str(p.id), "name": p.name,
                "base_price": float(p.price), "upgrade_price": float(p.upgrade_price),
                "is_unlimited": p.is_unlimited, "session_count": p.session_count,
            })
    return out


@router.post("/me/upgrade", response_model=MemberDetail)
async def upgrade_me(payload: UpgradeRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Member upgrade ke paket dengan HARGA UPGRADE (flat). Tiket/sisa lama dibiarkan.
    Paket dibuat FROZEN + tagihan PENDING → aktif setelah admin verifikasi pembayaran."""
    if user.role != UserRole.MEMBER:
        raise HTTPException(403, "Hanya untuk member")
    pkg = (await db.execute(select(Package).where(Package.id == payload.package_id))).scalar_one_or_none()
    if not pkg or not pkg.is_active:
        raise HTTPException(404, "Paket tidak ditemukan")
    from app.services.purchase import eligible_upgrade, create_purchase
    if not await eligible_upgrade(db, user.id, pkg):
        raise HTTPException(400, "Belum memenuhi syarat upgrade (harus sudah pernah bayar & belum pegang paket ini).")
    await create_purchase(
        db, member_id=user.id, package_id=pkg.id,
        method=PaymentMethod.TRANSFER, mark_paid=False, activate=False,
        price_paid=float(pkg.upgrade_price), note="Upgrade paket (menunggu pembayaran)",
    )
    return await _load_detail(db, user)


@router.post("/{user_id}/dropin-ticket", response_model=MemberDetail)
async def admin_add_dropin_ticket(
    user_id: uuid.UUID,
    payload: DropinTicketCreate,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Admin/owner catat tiket drop-in untuk member (mis. bayar tunai/transfer langsung)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    from app.services.purchase import create_dropin_ticket
    await create_dropin_ticket(
        db, member_id=user.id, method=payload.method,
        mark_paid=payload.mark_paid, price=payload.price, recorded_by=staff.id,
    )
    return await _load_detail(db, user)


@router.get("/{user_id}", response_model=MemberDetail)
async def get_user_detail(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    return await _load_detail(db, user)


@router.patch("/{user_id}", response_model=UserBrief)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    if user.role == UserRole.OWNER and actor.role != UserRole.OWNER:
        raise HTTPException(403, "Tidak bisa mengubah akun owner")

    data = payload.model_dump(exclude_unset=True)

    # Ganti nomor WA (harus unik antar user)
    if "phone" in data and data["phone"] and await phone_taken(db, data["phone"], exclude_id=user.id):
        raise HTTPException(400, "Nomor WhatsApp sudah dipakai akun lain")

    # Ganti email (harus unik)
    if "email" in data and data["email"]:
        new_email = data.pop("email").lower()
        if new_email != user.email:
            clash = (await db.execute(select(User.id).where(User.email == new_email, User.id != user.id))).scalar_one_or_none()
            if clash:
                raise HTTPException(400, "Email sudah dipakai akun lain")
            user.email = new_email

    # Ganti peran (dengan pengaman)
    if "role" in data and data["role"] is not None:
        new_role = data.pop("role")
        if new_role != user.role:
            if user.role == UserRole.OWNER or user.id == actor.id:
                raise HTTPException(400, "Peran akun ini tidak bisa diubah")
            _can_manage_role(actor, new_role)  # blokir set OWNER; admin tak bisa buat admin
            user.role = new_role

    for k, v in data.items():
        setattr(user, k, v)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/{user_id}/set-password", status_code=204)
async def admin_set_password(
    user_id: uuid.UUID,
    payload: SetPassword,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    """Admin/owner menetapkan password baru untuk seorang user (mis. member lupa & ganti nomor)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    if user.role == UserRole.OWNER and actor.role != UserRole.OWNER:
        raise HTTPException(403, "Tidak bisa mengubah akun owner")
    user.hashed_password = get_password_hash(payload.new_password)
    await db.flush()
    return None


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    """Hapus member/instruktur. Bila punya riwayat pembayaran → dinonaktifkan
    (data keuangan dijaga); bila belum ada riwayat → dihapus tuntas (cascade booking/paket).
    Owner & diri sendiri tak bisa dihapus; admin hanya owner yang boleh."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    if user.role == UserRole.OWNER:
        raise HTTPException(400, "Akun owner tidak bisa dihapus")
    if user.id == actor.id:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    if user.role == UserRole.ADMIN and actor.role != UserRole.OWNER:
        raise HTTPException(403, "Hanya owner yang bisa menghapus admin")

    pay_count = (
        await db.execute(select(func.count()).select_from(Payment).where(Payment.member_id == user_id))
    ).scalar_one()
    if pay_count:
        user.is_active = False
        return {"status": "deactivated", "message": "Member punya riwayat pembayaran → dinonaktifkan (data keuangan tetap tersimpan)."}
    await db.delete(user)
    return {"status": "deleted", "message": "Member dihapus."}


@router.post("/{user_id}/purchase", response_model=MemberDetail, status_code=201)
async def sell_package(
    user_id: uuid.UUID,
    payload: PurchaseCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    """Jual/assign paket ke member. Pakai mesin create_purchase (menerapkan aturan bulanan
    + carryover, atribusi akun, & update kategori). Diskon perpanjangan otomatis bila berhak."""
    from app.services.purchase import create_purchase, price_quote
    member = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member tidak ditemukan")
    pkg = (await db.execute(select(Package).where(Package.id == payload.package_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")

    note = payload.note
    if payload.price_paid is not None:
        price = float(payload.price_paid)  # admin set harga manual → dipakai apa adanya (tanpa diskon/upgrade otomatis)
    else:
        q = await price_quote(db, member.id, pkg)
        price = q["total"]
        if q["kind"] == "renewal":
            note = (note + " · " if note else "") + f"Diskon perpanjangan -{int(q['renewal_discount']):,}".replace(",", ".")
        elif q["kind"] == "upgrade":
            note = (note + " · " if note else "") + f"Upgrade (harga {int(q['upgrade_price']):,})".replace(",", ".")

    await create_purchase(
        db, member_id=member.id, package_id=pkg.id,
        method=payload.method, mark_paid=payload.mark_paid, price_paid=price,
        recorded_by=actor.id, note=note, activate=True, purchased_at=payload.purchased_at,
    )
    await db.refresh(member)
    return await _load_detail(db, member)


@router.get("/{user_id}/purchase-quote")
async def purchase_quote(
    user_id: uuid.UUID, package_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    """Pratinjau harga jual paket ke member ini (renewal / upgrade / normal)."""
    from app.services.purchase import price_quote
    pkg = (await db.execute(select(Package).where(Package.id == package_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")
    q = await price_quote(db, user_id, pkg)
    # backward-compat: 'eligible' = ada diskon perpanjangan
    q["eligible"] = q["kind"] == "renewal"
    return q


@router.post("/{user_id}/packages/{mp_id}/freeze", response_model=MemberPackageResponse)
async def freeze_package(
    user_id: uuid.UUID, mp_id: uuid.UUID,
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    mp = (await db.execute(
        select(MemberPackage).where(MemberPackage.id == mp_id, MemberPackage.member_id == user_id)
    )).scalar_one_or_none()
    if not mp:
        raise HTTPException(404, "Paket member tidak ditemukan")
    mp.status = (
        MemberPackageStatus.ACTIVE if mp.status == MemberPackageStatus.FROZEN
        else MemberPackageStatus.FROZEN
    )
    if mp.status == MemberPackageStatus.ACTIVE:
        refresh_status(mp)
    await db.flush()
    await db.refresh(mp)
    return mp


# ── Impor member dari Excel (migrasi data lama) ──
@router.get("/import/template")
async def import_template(_: User = Depends(require_staff)):
    """Unduh template Excel untuk impor member."""
    import io
    from fastapi.responses import StreamingResponse
    from app.services import member_import
    data = member_import.build_template_xlsx()
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="template_import_member.xlsx"'},
    )


@router.post("/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Pratinjau (dry-run) — validasi & tentukan aksi, TANPA menyimpan apa pun."""
    from app.services import member_import
    content = await file.read()
    try:
        return await member_import.analyze(db, content)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/import/commit")
async def import_commit(
    file: UploadFile = File(...),
    default_password: str = Form("reformer123"),
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_staff),
):
    """Jalankan impor (upsert per No. WA). Baris ber-error dilewati."""
    from app.services import member_import
    if len((default_password or "").strip()) < 6:
        raise HTTPException(400, "Password awal minimal 6 karakter")
    content = await file.read()
    try:
        result = await member_import.commit(db, content, default_password.strip(), actor_id=actor.id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.commit()
    return result
