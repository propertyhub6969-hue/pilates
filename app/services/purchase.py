"""Pembelian paket oleh member (self) atau staf. Buat MemberPackage (snapshot) + Payment."""
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.package import Package, MemberPackage, MemberPackageStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus


async def create_purchase(
    db: AsyncSession,
    member_id,
    package_id,
    method: PaymentMethod = PaymentMethod.CASH,
    mark_paid: bool = True,
    price_paid: float | None = None,
    recorded_by=None,
    note: str | None = None,
    activate: bool = True,
) -> tuple[MemberPackage, Payment]:
    """activate=False → paket FROZEN (belum bisa dipakai) sampai pembayaran diverifikasi
    (dipakai untuk self-enroll member: bayar dulu, aktif setelah admin konfirmasi)."""
    pkg = (await db.execute(select(Package).where(Package.id == package_id))).scalar_one_or_none()
    if not pkg or not pkg.is_active:
        raise HTTPException(404, "Paket tidak ditemukan / tidak aktif")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=pkg.validity_days) if pkg.validity_days else None
    price = price_paid if price_paid is not None else float(pkg.price)
    total = None if pkg.is_unlimited else pkg.session_count

    mp = MemberPackage(
        member_id=member_id,
        package_id=pkg.id,
        package_name=pkg.name,
        is_unlimited=pkg.is_unlimited,
        sessions_total=total,
        sessions_remaining=total,
        price_paid=price,
        purchased_at=now,
        expires_at=expires_at,
        status=MemberPackageStatus.ACTIVE if activate else MemberPackageStatus.FROZEN,
    )
    db.add(mp)
    await db.flush()

    account_id = None
    if mark_paid:
        from app.services.finance import resolve_income_account
        account_id = await resolve_income_account(db, method)

    payment = Payment(
        member_id=member_id,
        member_package_id=mp.id,
        amount=price,
        method=method,
        status=PaymentStatus.PAID if mark_paid else PaymentStatus.PENDING,
        paid_at=now if mark_paid else None,
        note=note,
        recorded_by_id=recorded_by,
        account_id=account_id,
    )
    db.add(payment)
    await db.flush()
    return mp, payment


async def create_dropin_ticket(
    db: AsyncSession,
    member_id,
    method: PaymentMethod = PaymentMethod.CASH,
    mark_paid: bool = True,
    price: float | None = None,
    recorded_by=None,
) -> tuple[MemberPackage, Payment]:
    """Tiket drop-in = paket 1 sesi prepaid untuk member per-datang.
    mark_paid=True (admin catat lunas) → tiket langsung AKTIF.
    mark_paid=False (self-serve, tunggu verifikasi bukti) → tiket FROZEN sampai pembayaran diverifikasi."""
    from app.models.studio import StudioSettings
    if price is None:
        studio = (await db.execute(select(StudioSettings))).scalars().first()
        price = float(studio.drop_in_price or 0) if studio else 0

    now = datetime.now(timezone.utc)
    mp = MemberPackage(
        member_id=member_id,
        package_id=None,
        package_name="Tiket Drop-in (1 sesi)",
        is_unlimited=False,
        sessions_total=1,
        sessions_remaining=1,
        price_paid=price,
        purchased_at=now,
        expires_at=None,
        status=MemberPackageStatus.ACTIVE if mark_paid else MemberPackageStatus.FROZEN,
    )
    db.add(mp)
    await db.flush()

    account_id = None
    if mark_paid:
        from app.services.finance import resolve_income_account
        account_id = await resolve_income_account(db, method)

    payment = Payment(
        member_id=member_id,
        member_package_id=mp.id,
        amount=price,
        method=method,
        status=PaymentStatus.PAID if mark_paid else PaymentStatus.PENDING,
        paid_at=now if mark_paid else None,
        note="Tiket Drop-in (1 sesi)",
        recorded_by_id=recorded_by,
        account_id=account_id,
    )
    db.add(payment)
    await db.flush()
    return mp, payment
