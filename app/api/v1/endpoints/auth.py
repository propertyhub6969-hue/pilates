import os
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token,
)
from app.schemas.auth import (
    MemberRegister, UserLogin, Token, TokenRefresh, UserResponse,
)
from app.schemas.studio import ChangePassword
from app.models.user import User, UserRole
from app.api.deps import get_current_user

router = APIRouter()


def _tokens_for(user: User) -> Token:
    claims = {"sub": str(user.id), "role": user.role.value}
    return Token(
        access_token=create_access_token(claims),
        refresh_token=create_refresh_token(claims),
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_member(payload: MemberRegister, db: AsyncSession = Depends(get_db)):
    """Registrasi mandiri member baru. Selalu dibuat dengan role MEMBER."""
    existing = (
        await db.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    user = User(
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        role=UserRole.MEMBER,
        member_category=payload.member_category,
        join_date=date.today(),
    )
    db.add(user)
    await db.flush()

    # Self-enrollment: beli paket sekaligus (tagihan PENDING, dikonfirmasi staf saat bayar)
    if payload.package_id is not None:
        from app.services.purchase import create_purchase
        await create_purchase(
            db, member_id=user.id, package_id=payload.package_id,
            method=payload.payment_method, mark_paid=False,
            note="Pendaftaran online (menunggu pembayaran)",
        )

    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    user = (
        await db.execute(select(User).where(User.email == payload.email.lower()))
    ).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun non-aktif. Hubungi admin.")
    return _tokens_for(user)


@router.post("/refresh", response_model=Token)
async def refresh(payload: TokenRefresh, db: AsyncSession = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if data is None or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token tidak valid")
    try:
        uid = uuid.UUID(data.get("sub"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Refresh token tidak valid")
    user = (
        await db.execute(select(User).where(User.id == uid))
    ).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User tidak ditemukan atau non-aktif")
    return _tokens_for(user)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", status_code=204)
async def change_password(
    payload: ChangePassword,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ganti password sendiri (butuh password lama)."""
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Password lama salah")
    user.hashed_password = get_password_hash(payload.new_password)
    await db.flush()
    return None


# ─────────────── FOTO PROFIL ───────────────
UPLOAD_DIR = "/app/uploads"
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
IMG_ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
AVATAR_MAX = 5 * 1024 * 1024  # 5 MB


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Unggah/ganti foto profil sendiri."""
    ext = IMG_ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Format tidak didukung. Unggah gambar JPG, PNG, atau WebP.")
    data = await file.read()
    if len(data) > AVATAR_MAX:
        raise HTTPException(400, "Ukuran foto maksimal 5 MB")
    os.makedirs(AVATAR_DIR, exist_ok=True)
    # hapus file lama bila ekstensinya berbeda (hindari file yatim)
    if user.avatar_path:
        old = os.path.join(UPLOAD_DIR, user.avatar_path)
        if os.path.exists(old) and not old.endswith(ext):
            try:
                os.remove(old)
            except OSError:
                pass
    fname = f"{user.id}{ext}"
    with open(os.path.join(AVATAR_DIR, fname), "wb") as fh:
        fh.write(data)
    user.avatar_path = f"avatars/{fname}"
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/me/avatar", response_model=UserResponse)
async def delete_avatar(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Hapus foto profil sendiri (kembali ke inisial)."""
    if user.avatar_path:
        full = os.path.join(UPLOAD_DIR, user.avatar_path)
        if os.path.exists(full):
            try:
                os.remove(full)
            except OSError:
                pass
        user.avatar_path = None
        await db.flush()
        await db.refresh(user)
    return user


@router.get("/users/{user_id}/avatar")
async def get_avatar(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Sajikan foto profil (publik agar bisa dipakai langsung di tag <img>)."""
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u or not u.avatar_path:
        raise HTTPException(404, "Tidak ada foto")
    full = os.path.join(UPLOAD_DIR, u.avatar_path)
    if not os.path.exists(full):
        raise HTTPException(404, "File foto hilang")
    return FileResponse(full)
