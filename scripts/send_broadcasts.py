"""
Broadcast jadwal via WhatsApp (Fase 2).
  --kind bulanan : post SATU pesan ke grup (sesi H-<bulanan_open_days> ke depan)
  --kind dropin  : pesan personal ber-jeda ke per-datang bertiket (sesi H-<dropin_open_days>)

Hanya berjalan bila StudioSettings.wa_broadcast_enabled = True (kalau tidak → no-op).
Dijadwalkan harian 20:00 WITA (= 12:00 UTC) lewat scripts/cron_broadcasts.sh.

Contoh:
    docker compose -f docker-compose.prod.yml exec -T backend python -m scripts.send_broadcasts --kind bulanan
"""
import argparse
import asyncio
from datetime import date, timedelta

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services import broadcast as bc
from app.services.booking import get_studio


async def main(kind: str) -> None:
    mode = "KIRIM" if settings.WA_ENABLED and settings.WA_GATEWAY_URL else "DRY-RUN (tak mengirim)"
    print(f"== Broadcast [{kind}] — mode: {mode} ==")
    async with AsyncSessionLocal() as db:
        studio = await get_studio(db)
        if not studio.wa_broadcast_enabled:
            print("Broadcast WhatsApp DIMATIKAN di Pengaturan — no-op.")
            return
        today = date.today()
        if kind == "bulanan":
            td = today + timedelta(days=studio.bulanan_open_days_before or 2)
            res = await bc.announce_bulanan(db, td)
        else:
            td = today + timedelta(days=studio.dropin_open_days_before or 1)
            res = await bc.notify_dropin(db, td)
        await db.commit()
    print("Hasil:", res)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--kind", choices=["bulanan", "dropin"], default="bulanan")
    a = p.parse_args()
    asyncio.run(main(a.kind))
