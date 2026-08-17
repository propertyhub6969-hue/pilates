from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff, require_owner
from app.models.user import User
from app.models.studio import StudioSettings
from app.schemas.studio import StudioSettingsResponse, StudioSettingsUpdate

router = APIRouter()


@router.get("/wa-groups")
async def wa_groups(_: User = Depends(require_owner)):
    """Daftar grup WhatsApp yang diikuti akun gateway (utk dipilih di Pengaturan)."""
    from app.services.whatsapp import list_wa_groups
    return await list_wa_groups()


async def _get_or_create(db: AsyncSession) -> StudioSettings:
    s = (await db.execute(select(StudioSettings))).scalars().first()
    if s is None:
        s = StudioSettings()
        db.add(s)
        await db.flush()
        await db.refresh(s)
    return s


@router.get("/settings", response_model=StudioSettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    return await _get_or_create(db)


@router.patch("/settings", response_model=StudioSettingsResponse)
async def update_settings(
    payload: StudioSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    s = await _get_or_create(db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    await db.flush()
    await db.refresh(s)
    return s
