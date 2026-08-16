import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole

security = HTTPBearer()

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Tidak dapat memvalidasi kredensial",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validasi access token lalu muat baris user (role & status selalu live dari DB)."""
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise _credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise _credentials_exception
    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise _credentials_exception

    user = (
        await db.execute(select(User).where(User.id == uid))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User tidak ditemukan atau non-aktif",
        )
    return user


def require_roles(*roles: UserRole):
    """Dependency factory: hanya izinkan user dengan salah satu role di `roles`."""
    allowed = set(roles)

    async def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Anda tidak punya akses ke sumber daya ini",
            )
        return user

    return _guard


# Guard siap-pakai
require_staff = require_roles(UserRole.OWNER, UserRole.ADMIN)
require_owner = require_roles(UserRole.OWNER)
