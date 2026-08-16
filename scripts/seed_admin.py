"""
Seed awal: buat baris StudioSettings (singleton) + akun OWNER pertama.
Idempoten — aman dijalankan berulang (tak menduplikasi).

Jalankan:
    docker compose exec backend python -m scripts.seed_admin
Env opsional: OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME, STUDIO_NAME
"""
import asyncio
import os
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.studio import StudioSettings

OWNER_EMAIL = os.getenv("OWNER_EMAIL", "owner@reformeryourbody.id")
OWNER_PASSWORD = os.getenv("OWNER_PASSWORD", "reformer123")
OWNER_NAME = os.getenv("OWNER_NAME", "Owner Reformer")
STUDIO_NAME = os.getenv("STUDIO_NAME", "Reformer Your Body")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        # Studio settings singleton
        settings_row = (await db.execute(select(StudioSettings))).scalars().first()
        if settings_row is None:
            db.add(StudioSettings(name=STUDIO_NAME))
            print(f"✓ StudioSettings dibuat: {STUDIO_NAME}")
        else:
            print("• StudioSettings sudah ada — dilewati")

        # Owner
        owner = (
            await db.execute(select(User).where(User.email == OWNER_EMAIL))
        ).scalar_one_or_none()
        if owner is None:
            db.add(User(
                email=OWNER_EMAIL,
                hashed_password=get_password_hash(OWNER_PASSWORD),
                full_name=OWNER_NAME,
                role=UserRole.OWNER,
                is_active=True,
            ))
            print(f"✓ Owner dibuat: {OWNER_EMAIL} / {OWNER_PASSWORD}")
        else:
            print(f"• Owner {OWNER_EMAIL} sudah ada — dilewati")

        await db.commit()
    print("Selesai.")


if __name__ == "__main__":
    asyncio.run(main())
