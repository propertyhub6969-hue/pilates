"""Utilitas saldo kuota / status MemberPackage."""
from datetime import datetime, timezone
from app.models.package import MemberPackage, MemberPackageStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def refresh_status(mp: MemberPackage) -> MemberPackage:
    """Perbarui status paket bila kedaluwarsa / kuota habis. Tidak menyentuh FROZEN/CANCELLED."""
    if mp.status in (MemberPackageStatus.FROZEN, MemberPackageStatus.CANCELLED):
        return mp
    if mp.expires_at is not None and mp.expires_at < _now():
        mp.status = MemberPackageStatus.EXPIRED
    elif not mp.is_unlimited and (mp.sessions_remaining or 0) <= 0:
        mp.status = MemberPackageStatus.USED_UP
    else:
        mp.status = MemberPackageStatus.ACTIVE
    return mp


def is_usable(mp: MemberPackage) -> bool:
    """Paket masih bisa dipakai booking (aktif, belum kedaluwarsa, ada kuota / unlimited)."""
    if mp.status != MemberPackageStatus.ACTIVE:
        return False
    if mp.expires_at is not None and mp.expires_at < _now():
        return False
    if mp.is_unlimited:
        return True
    return (mp.sessions_remaining or 0) > 0
