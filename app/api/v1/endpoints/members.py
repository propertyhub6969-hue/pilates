import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.deps import get_current_user, require_staff, require_owner
from app.models.user import User, UserRole, MemberCategory
from app.models.package import Package, MemberPackage, MemberPackageStatus
from app.models.payment import Payment, PaymentStatus, PaymentMethod
from app.schemas.common import Page
from app.schemas.member import (
    UserCreate, UserUpdate, UserBrief, MemberDetail,
    MemberPackageResponse, PaymentResponse, PurchaseCreate, EnrollRequest,
)
from app.schemas.auth import SetPassword
from app.services.quota import refresh_status, is_usable

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
    if active_only:
        stmt = stmt.where(User.is_active.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (
        await db.execute(stmt.order_by(User.full_name.asc()).limit(limit).offset(offset))
    ).scalars().all()

    # Ringkasan kuota utk member yang tampil di halaman ini
    member_ids = [u.id for u in rows if u.role == UserRole.MEMBER]
    quota: dict = {}
    if member_ids:
        mps = (
            await db.execute(select(MemberPackage).where(MemberPackage.member_id.in_(member_ids)))
        ).scalars().all()
        by_member: dict = {}
        for mp in mps:
            by_member.setdefault(mp.member_id, []).append(mp)
        for mid, pkgs in by_member.items():
            usable = [mp for mp in pkgs if is_usable(mp)]
            has_unl = any(mp.is_unlimited for mp in usable)
            remaining = None if has_unl else sum((mp.sessions_remaining or 0) for mp in usable)
            quota[mid] = (remaining, has_unl)

    items = []
    for u in rows:
        brief = UserBrief.model_validate(u)
        if u.id in quota:
            brief.active_sessions_remaining, brief.has_unlimited = quota[u.id]
        items.append(brief)
    return Page(items=items, total=total)


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
        # Per datang: buat tagihan drop-in pertama (menunggu pembayaran).
        # Booking pertama nanti memakai tagihan ini (lihat services/booking._ensure_dropin_payment).
        from app.models.studio import StudioSettings
        studio = (await db.execute(select(StudioSettings))).scalars().first()
        price = float(studio.drop_in_price or 0) if studio else 0
        if price > 0:
            db.add(Payment(
                member_id=user.id, amount=price, method=PaymentMethod.TRANSFER,
                status=PaymentStatus.PENDING, note="Drop-in (per datang) — aktivasi",
            ))
            await db.flush()
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
    for k, v in payload.model_dump(exclude_unset=True).items():
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
    """Jual/assign paket ke member: buat MemberPackage (snapshot) + catat Payment."""
    member = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Member tidak ditemukan")
    pkg = (await db.execute(select(Package).where(Package.id == payload.package_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")

    purchased_at = payload.purchased_at or datetime.now(timezone.utc)
    expires_at = purchased_at + timedelta(days=pkg.validity_days) if pkg.validity_days else None
    price_paid = payload.price_paid if payload.price_paid is not None else float(pkg.price)
    total = None if pkg.is_unlimited else pkg.session_count

    mp = MemberPackage(
        member_id=member.id,
        package_id=pkg.id,
        package_name=pkg.name,
        is_unlimited=pkg.is_unlimited,
        sessions_total=total,
        sessions_remaining=total,
        price_paid=price_paid,
        purchased_at=purchased_at,
        expires_at=expires_at,
        status=MemberPackageStatus.ACTIVE,
    )
    db.add(mp)
    await db.flush()

    payment = Payment(
        member_id=member.id,
        member_package_id=mp.id,
        amount=price_paid,
        method=payload.method,
        status=PaymentStatus.PAID if payload.mark_paid else PaymentStatus.PENDING,
        paid_at=datetime.now(timezone.utc) if payload.mark_paid else None,
        note=payload.note,
        recorded_by_id=actor.id,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(member)
    return await _load_detail(db, member)


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
