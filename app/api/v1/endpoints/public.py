from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.studio import StudioSettings
from app.models.package import Package
from app.models.branch import Branch
from pydantic import BaseModel
from typing import Optional, List
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
    if not s:
        return StudioPublic(name="Reformer Your Body")
    return StudioPublic(name=s.name, tagline=s.tagline, address=s.address, phone=s.phone)


@router.get("/packages", response_model=List[PackagePublic])
async def public_packages(db: AsyncSession = Depends(get_db)):
    """Paket aktif untuk ditampilkan di landing (tanpa autentikasi)."""
    rows = (
        await db.execute(
            select(Package).where(Package.is_active.is_(True)).order_by(Package.price.asc())
        )
    ).scalars().all()
    return rows
