"""Pembelian paket oleh member (self) atau staf. Buat MemberPackage (snapshot) + Payment."""
from datetime import datetime, timezone, timedelta
from calendar import monthrange
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.package import Package, MemberPackage, MemberPackageStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.services.quota import refresh_status

TZ = ZoneInfo(settings.TIMEZONE)


def _end_of_month(d) -> datetime:
    """Akhir bulan `d` pukul 23:59:59 zona studio (WITA)."""
    last = monthrange(d.year, d.month)[1]
    return datetime(d.year, d.month, last, 23, 59, 59, tzinfo=TZ)


def _next_month_end(d) -> datetime:
    """Akhir bulan SETELAH bulan `d`."""
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    last = monthrange(y, m)[1]
    return datetime(y, m, last, 23, 59, 59, tzinfo=TZ)


async def apply_monthly_expiry(db: AsyncSession, mp: MemberPackage) -> None:
    """Terapkan aturan paket BULANAN saat paket menjadi AKTIF:
    - Kedaluwarsa = akhir bulan pembayaran.
    - Bila member masih punya paket bulanan lama yang VALID (perpanjang tepat waktu) →
      sisa sesinya diakumulasi ke paket ini & paket baru berlaku s/d akhir bulan BERIKUTNYA;
      paket lama ditutup. Bila tidak ada (baru/telat) → berlaku s/d akhir bulan ini, tanpa carryover.
    """
    now = datetime.now(timezone.utc)
    priors = (
        await db.execute(
            select(MemberPackage).where(
                MemberPackage.member_id == mp.member_id,
                MemberPackage.id != mp.id,
                MemberPackage.monthly_expiry.is_(True),
                MemberPackage.status == MemberPackageStatus.ACTIVE,
            )
        )
    ).scalars().all()
    valid = [p for p in priors if p.expires_at and p.expires_at > now and not p.is_unlimited and (p.sessions_remaining or 0) > 0]
    carry = sum(p.sessions_remaining for p in valid)

    if valid:
        base = max(p.expires_at for p in valid)          # kedaluwarsa terbaru dari paket lama
        mp.expires_at = _next_month_end(base.astimezone(TZ).date())
    else:
        mp.expires_at = _end_of_month(datetime.now(TZ).date())

    for p in valid:                                       # paket lama digantikan → tutup
        p.sessions_remaining = 0
        p.status = MemberPackageStatus.CANCELLED
    for p in priors:                                      # paket bulanan yang sudah lewat → hangus/EXPIRED
        if p not in valid and p.expires_at and p.expires_at <= now:
            p.status = MemberPackageStatus.EXPIRED

    if carry and not mp.is_unlimited and mp.sessions_remaining is not None:
        mp.sessions_total = (mp.sessions_total or 0) + carry
        mp.sessions_remaining = (mp.sessions_remaining or 0) + carry
    refresh_status(mp)

    # Member yang sempat dinonaktifkan ke Per-Datang otomatis kembali ke Bulanan
    # begitu paket bulanan aktif lagi. Kategori Private/Bulanan tidak ditimpa.
    from app.models.user import User, MemberCategory
    member = await db.get(User, mp.member_id)
    if member and member.member_category in (None, MemberCategory.PER_DATANG):
        member.member_category = MemberCategory.BULANAN


async def eligible_renewal_discount(db: AsyncSession, member_id, pkg: Package) -> float:
    """Potongan perpanjangan (Rp) bila member MASIH punya paket YANG SAMA yang belum expired.
    0 bila paket tak punya diskon / member tak memenuhi syarat."""
    disc = float(pkg.renewal_discount or 0)
    if disc <= 0:
        return 0.0
    now = datetime.now(timezone.utc)
    existing = (
        await db.execute(
            select(MemberPackage).where(
                MemberPackage.member_id == member_id,
                MemberPackage.package_id == pkg.id,
                MemberPackage.status == MemberPackageStatus.ACTIVE,
            )
        )
    ).scalars().all()
    for mp in existing:
        if mp.expires_at is None or mp.expires_at > now:
            return disc  # masih punya paket ini & belum expired → berhak diskon
    return 0.0


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
    purchased_at: datetime | None = None,
) -> tuple[MemberPackage, Payment]:
    """activate=False → paket FROZEN (belum bisa dipakai) sampai pembayaran diverifikasi
    (dipakai untuk self-enroll member: bayar dulu, aktif setelah admin konfirmasi)."""
    pkg = (await db.execute(select(Package).where(Package.id == package_id))).scalar_one_or_none()
    if not pkg or not pkg.is_active:
        raise HTTPException(404, "Paket tidak ditemukan / tidak aktif")

    now = datetime.now(timezone.utc)
    pdate = purchased_at or now
    expires_at = pdate + timedelta(days=pkg.validity_days) if pkg.validity_days else None
    price = price_paid if price_paid is not None else float(pkg.price)
    total = None if pkg.is_unlimited else pkg.session_count

    mp = MemberPackage(
        member_id=member_id,
        package_id=pkg.id,
        package_name=pkg.name,
        is_unlimited=pkg.is_unlimited,
        monthly_expiry=pkg.monthly_expiry,
        sessions_total=total,
        sessions_remaining=total,
        price_paid=price,
        purchased_at=pdate,
        expires_at=expires_at,
        status=MemberPackageStatus.ACTIVE if activate else MemberPackageStatus.FROZEN,
    )
    db.add(mp)
    await db.flush()
    # Paket bulanan yang langsung AKTIF → hitung kedaluwarsa akhir bulan + akumulasi sisa.
    if pkg.monthly_expiry and activate:
        await apply_monthly_expiry(db, mp)
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
