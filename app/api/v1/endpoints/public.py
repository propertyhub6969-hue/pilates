import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from sqlalchemy import func
from app.models.studio import StudioSettings
from app.models.package import Package
from app.models.branch import Branch
from app.models.user import User, UserRole
from app.models.schedule import ClassSession, ClassSessionStatus
from app.services import landing_media as lm
from app.services import booking as booking_svc
from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid

router = APIRouter()


class BranchPublic(BaseModel):
    id: uuid.UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/branches", response_model=List[BranchPublic])
async def public_branches(db: AsyncSession = Depends(get_db)):
    """Cabang aktif untuk landing page (tanpa autentikasi)."""
    rows = (
        await db.execute(
            select(Branch).where(Branch.is_active.is_(True)).order_by(Branch.is_default.desc(), Branch.name.asc())
        )
    ).scalars().all()
    return rows


class StudioPublic(BaseModel):
    name: str
    tagline: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    announcement: Optional[str] = None  # hanya diisi bila pengumuman aktif
    media: Dict[str, str] = {}          # {slot: url} gambar landing yang tersedia


class PackagePublic(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_unlimited: bool
    session_count: Optional[int] = None
    price: float

    class Config:
        from_attributes = True


@router.get("/studio", response_model=StudioPublic)
async def public_studio(db: AsyncSession = Depends(get_db)):
    """Info studio untuk landing page (tanpa autentikasi)."""
    s = (await db.execute(select(StudioSettings))).scalars().first()
    media = lm.present_slots()
    if not s:
        return StudioPublic(name="Reformer Your Body", media=media)
    ann = s.announcement if getattr(s, "announcement_active", False) and (s.announcement or "").strip() else None
    return StudioPublic(name=s.name, tagline=s.tagline, address=s.address, phone=s.phone, announcement=ann, media=media)


class PublicStats(BaseModel):
    members_active: int   # member aktif (role member, is_active)
    branches: int         # cabang aktif
    capacity: int         # kapasitas maks / kelas (kelas kecil)
    sessions_done: int    # sesi kelas yang sudah terlaksana (tanggal lewat, tidak dibatalkan)


@router.get("/stats", response_model=PublicStats)
async def public_stats(db: AsyncSession = Depends(get_db)):
    """Statistik nyata untuk landing (tanpa autentikasi)."""
    members = (await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.MEMBER, User.is_active.is_(True))
    )).scalar_one()
    branches = (await db.execute(
        select(func.count()).select_from(Branch).where(Branch.is_active.is_(True))
    )).scalar_one()
    s = (await db.execute(select(StudioSettings))).scalars().first()
    capacity = s.default_capacity if s else 14
    sessions_done = (await db.execute(
        select(func.count()).select_from(ClassSession).where(
            ClassSession.session_date < booking_svc.today_local(),
            ClassSession.status != ClassSessionStatus.CANCELLED,
        )
    )).scalar_one()
    return PublicStats(members_active=members, branches=branches, capacity=capacity, sessions_done=sessions_done)


@router.get("/media/{slot}")
async def public_media(slot: str):
    """Sajikan gambar landing sebuah slot (tanpa autentikasi)."""
    if slot not in lm.SLOTS:
        raise HTTPException(404, "Slot tidak dikenal")
    p = lm.path_for_slot(slot)
    if not p or not os.path.exists(p):
        raise HTTPException(404, "Belum ada gambar")
    return FileResponse(p)


@router.get("/packages", response_model=List[PackagePublic])
async def public_packages(db: AsyncSession = Depends(get_db)):
    """Paket aktif untuk ditampilkan di landing (tanpa autentikasi)."""
    rows = (
        await db.execute(
            select(Package).where(Package.is_active.is_(True)).order_by(Package.price.asc())
        )
    ).scalars().all()
    return rows
