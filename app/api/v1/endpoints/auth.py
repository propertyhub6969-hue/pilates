import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
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
        join_date=date.today(),
    )
    db.add(user)
    await db.flush()
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
