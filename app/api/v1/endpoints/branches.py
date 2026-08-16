import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, require_staff
from app.models.user import User
from app.models.branch import Branch
from app.models.studio import StudioSettings
from app.models.schedule import ClassSession, ClassTemplate
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse

router = APIRouter()


@router.get("", response_model=list[BranchResponse])
async def list_branches(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Daftar cabang. Member/umum hanya lihat yang aktif; staf bisa semua."""
    stmt = select(Branch)
    if not (include_inactive and user.is_staff()):
        stmt = stmt.where(Branch.is_active.is_(True))
    stmt = stmt.order_by(Branch.is_default.desc(), Branch.name.asc())
    return (await db.execute(stmt)).scalars().all()


@router.post("", response_model=BranchResponse, status_code=201)
async def create_branch(payload: BranchCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    # Default aturan booking dari StudioSettings bila tak diisi
    settings_row = (await db.execute(select(StudioSettings))).scalars().first()
    cwh = payload.cancellation_window_hours
    blc = payload.booking_lead_close_hours
    if cwh is None:
        cwh = settings_row.cancellation_window_hours if settings_row else 12
    if blc is None:
        blc = settings_row.booking_lead_close_hours if settings_row else 0

    branch = Branch(
        name=payload.name.strip(),
        address=payload.address,
        phone=payload.phone,
        cancellation_window_hours=cwh,
        booking_lead_close_hours=blc,
        is_active=True,
        is_default=False,
    )
    db.add(branch)
    await db.flush()
    await db.refresh(branch)
    return branch


@router.patch("/{branch_id}", response_model=BranchResponse)
async def update_branch(branch_id: uuid.UUID, payload: BranchUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    branch = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, "Cabang tidak ditemukan")
    data = payload.model_dump(exclude_unset=True)
    if branch.is_default and data.get("is_active") is False:
        raise HTTPException(400, "Cabang utama tidak bisa dinonaktifkan")
    for k, v in data.items():
        setattr(branch, k, v)
    await db.flush()
    await db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=204)
async def delete_branch(branch_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    """Hapus cabang bila belum punya jadwal; kalau sudah, non-aktifkan. Cabang utama tak bisa dihapus."""
    branch = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if not branch:
        raise HTTPException(404, "Cabang tidak ditemukan")
    if branch.is_default:
        raise HTTPException(400, "Cabang utama tidak bisa dihapus")
    used = (
        await db.execute(select(func.count()).select_from(ClassSession).where(ClassSession.branch_id == branch_id))
    ).scalar_one()
    used += (
        await db.execute(select(func.count()).select_from(ClassTemplate).where(ClassTemplate.branch_id == branch_id))
    ).scalar_one()
    if used:
        branch.is_active = False
    else:
        await db.delete(branch)
    return None
