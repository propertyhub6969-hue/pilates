import os
import uuid
import hashlib
import secrets
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token,
)
from app.schemas.auth import (
    MemberRegister, UserLogin, Token, TokenRefresh, UserResponse,
    ForgotPassword, ResetPassword,
)
from app.schemas.studio import ChangePassword
from app.models.user import User, UserRole
from app.models.password_reset import PasswordResetOTP
from app.api.deps import get_current_user

router = APIRouter()

_GENERIC_RESET_MSG = "Jika data cocok, kode reset telah dikirim via WhatsApp."


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

    from app.services.whatsapp import phone_taken
    if payload.phone and await phone_taken(db, payload.phone):
        raise HTTPException(status_code=400, detail="Nomor WhatsApp sudah terdaftar")

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
    user = await _find_user_by_identifier(db, payload.identifier)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email/No. WhatsApp atau password salah")
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


# ─────────────── LUPA PASSWORD (WA OTP) ───────────────
OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def _find_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    ident = identifier.strip()
    if "@" in ident:
        return (await db.execute(select(User).where(User.email == ident.lower()))).scalar_one_or_none()
    # cocokkan lewat nomor telepon (normalisasi format Indonesia)
    from app.services.whatsapp import normalize_phone
    target = normalize_phone(ident)
    if not target:
        return None
    rows = (await db.execute(select(User).where(User.phone.isnot(None)))).scalars().all()
    for u in rows:
        if normalize_phone(u.phone or "") == target:
            return u
    return None


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPassword, db: AsyncSession = Depends(get_db)):
    """Kirim kode OTP reset via WhatsApp. Respons selalu generik (anti-enumerasi)."""
    user = await _find_user_by_identifier(db, payload.identifier)
    if not user:
        print(f"[forgot-password] user TIDAK ditemukan utk identifier={payload.identifier!r}")
    elif not (user.is_active and user.phone):
        print(f"[forgot-password] user={user.full_name} tapi active={user.is_active} phone={user.phone!r} — tidak dikirim")
    if user and user.is_active and user.phone:
        # batalkan kode lama yang belum terpakai
        await db.execute(
            update(PasswordResetOTP).where(
                PasswordResetOTP.user_id == user.id, PasswordResetOTP.used.is_(False)
            ).values(used=True)
        )
        code = f"{secrets.randbelow(1_000_000):06d}"
        otp = PasswordResetOTP(
            user_id=user.id, code_hash=_hash_code(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        )
        db.add(otp)
        await db.flush()
        from app.services.whatsapp import send_whatsapp
        msg = (
            f"*Reformer Your Body*\n\nKode reset password Anda: *{code}*\n"
            f"Berlaku {OTP_TTL_MINUTES} menit. Jangan bagikan kode ini ke siapa pun.\n\n"
            "Abaikan pesan ini jika Anda tidak meminta reset password."
        )
        try:
            ok, info = await send_whatsapp(user.phone, msg)
            print(f"[forgot-password] kirim OTP ke {user.full_name} ({user.phone}) → ok={ok} info={info}")
        except Exception as e:  # noqa: BLE001
            print(f"[forgot-password] GAGAL kirim WA ke {user.phone}: {e}")
    return {"ok": True, "message": _GENERIC_RESET_MSG}


@router.post("/reset-password")
async def reset_password(payload: ResetPassword, db: AsyncSession = Depends(get_db)):
    """Verifikasi kode OTP lalu set password baru."""
    user = await _find_user_by_identifier(db, payload.identifier)
    if not user:
        raise HTTPException(400, "Kode salah atau kedaluwarsa. Minta kode baru.")
    otp = (
        await db.execute(
            select(PasswordResetOTP).where(
                PasswordResetOTP.user_id == user.id, PasswordResetOTP.used.is_(False)
            ).order_by(PasswordResetOTP.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if not otp or otp.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Kode salah atau kedaluwarsa. Minta kode baru.")
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        otp.used = True
        await db.flush()
        raise HTTPException(400, "Terlalu banyak percobaan. Minta kode baru.")
    if _hash_code(payload.code.strip()) != otp.code_hash:
        otp.attempts += 1
        await db.flush()
        raise HTTPException(400, "Kode salah. Coba lagi.")
    # sukses
    user.hashed_password = get_password_hash(payload.new_password)
    otp.used = True
    await db.flush()
    return {"ok": True, "message": "Password berhasil diganti. Silakan login."}
