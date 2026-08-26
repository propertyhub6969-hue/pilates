import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, require_staff
from app.models.user import User
from app.models.package import Package, MemberPackage
from app.schemas.common import Page
from app.schemas.package import PackageCreate, PackageUpdate, PackageResponse

router = APIRouter()


async def _clear_other_popular(db: AsyncSession, keep_id: uuid.UUID | None) -> None:
    """Pastikan hanya satu paket bertanda 'Paling Populer'."""
    stmt = update(Package).where(Package.is_popular.is_(True)).values(is_popular=False)
    if keep_id is not None:
        stmt = stmt.where(Package.id != keep_id)
    await db.execute(stmt)


@router.get("", response_model=Page[PackageResponse])
async def list_packages(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Daftar paket. Member hanya lihat yang aktif; staf bisa lihat semua."""
    stmt = select(Package)
    if active_only or not user.is_staff():
        stmt = stmt.where(Package.is_active.is_(True))
    stmt = stmt.order_by(Package.is_active.desc(), Package.price.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return Page(items=rows, total=len(rows))


@router.post("", response_model=PackageResponse, status_code=201)
async def create_package(
    payload: PackageCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    pkg = Package(**payload.model_dump())
    if pkg.is_unlimited:
        pkg.session_count = None
    db.add(pkg)
    await db.flush()
    if pkg.is_popular:
        await _clear_other_popular(db, keep_id=pkg.id)
    await db.refresh(pkg)
    return pkg


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pkg = (await db.execute(select(Package).where(Package.id == package_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")
    return pkg


@router.patch("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: uuid.UUID,
    payload: PackageUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    pkg = (await db.execute(select(Package).where(Package.id == package_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(pkg, k, v)
    if pkg.is_unlimited:
        pkg.session_count = None
    await db.flush()
    if data.get("is_popular"):
        await _clear_other_popular(db, keep_id=pkg.id)
    await db.refresh(pkg)
    return pkg


@router.delete("/{package_id}", status_code=204)
async def delete_package(
    package_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Hapus paket bila belum pernah dibeli; kalau sudah, cukup non-aktifkan (arsip)."""
    pkg = (await db.execute(select(Package).where(Package.id == package_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(404, "Paket tidak ditemukan")
    used = (
        await db.execute(
            select(func.count()).select_from(MemberPackage).where(MemberPackage.package_id == package_id)
        )
    ).scalar_one()
    if used:
        pkg.is_active = False  # arsipkan, jangan hapus — jaga riwayat pembelian
    else:
        await db.delete(pkg)
    return None
