from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff, require_owner
from app.models.user import User
from app.models.studio import StudioSettings
from app.schemas.studio import StudioSettingsResponse, StudioSettingsUpdate
from app.services import landing_media as lm

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


# ── Gambar landing page (hero, foto kelas, dll) ──
@router.get("/landing-media")
async def list_landing_media(_: User = Depends(require_staff)):
    """Slot gambar landing yang sudah terisi → {slot: url}."""
    return lm.present_slots()


@router.post("/landing-media/{slot}")
async def upload_landing_media(slot: str, file: UploadFile = File(...), _: User = Depends(require_staff)):
    """Unggah/ganti gambar landing untuk sebuah slot (hero, about, class1-3)."""
    if slot not in lm.SLOTS:
        raise HTTPException(404, "Slot tidak dikenal")
    ext = lm.ALLOWED_EXT.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Format tidak didukung. Unggah gambar JPG, PNG, atau WebP.")
    data = await file.read()
    if len(data) > lm.MAX_BYTES:
        raise HTTPException(400, "Ukuran gambar maksimal 8 MB")
    lm.save_slot(slot, ext, data)
    return {"ok": True, "media": lm.present_slots()}


@router.delete("/landing-media/{slot}", status_code=204)
async def delete_landing_media(slot: str, _: User = Depends(require_staff)):
    """Hapus gambar landing sebuah slot (kembali ke placeholder)."""
    if slot not in lm.SLOTS:
        raise HTTPException(404, "Slot tidak dikenal")
    lm.remove_slot(slot)
    return None
