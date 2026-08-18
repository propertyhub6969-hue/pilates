"""
Broadcast jadwal via WhatsApp (Fase 2).
  --kind bulanan : post SATU pesan ke grup (sesi H-<bulanan_open_days> ke depan)
  --kind dropin  : pesan personal ber-jeda ke per-datang bertiket (sesi H-<dropin_open_days>)

Hanya berjalan bila StudioSettings.wa_broadcast_enabled = True (kalau tidak → no-op).

★ JAM KIRIM mengikuti Pengaturan:
  - dropin  → studio.dropin_open_time
  - bulanan → studio.bulanan_open_time
Cron dijalankan tiap 15 menit (scripts/cron_broadcasts.sh); script hanya MENGIRIM saat
jam WITA saat ini berada di slot 15 menit yang dimulai pada jam setting itu. Jadi jam
kirim = jam yang sama dengan jam buka booking → cukup diatur 1x di halaman Pengaturan.
Gunakan --force untuk mengirim manual tanpa memperhatikan jam (mis. uji coba).

Contoh:
    docker compose -f docker-compose.prod.yml exec -T backend python -m scripts.send_broadcasts --kind dropin --force
"""
import argparse
import asyncio
from datetime import timedelta

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services import broadcast as bc
from app.services.booking import get_studio, today_local, now_local

# Toleransi = interval cron. Kirim bila 0 <= (menit_sekarang - menit_setting) < WINDOW.
WINDOW_MINUTES = 15


def _to_minutes(hhmm: str) -> int:
    try:
        h, m = str(hhmm or "20:00").split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return 20 * 60


def _within_window(send_hhmm: str) -> bool:
    now = now_local()
    now_min = now.hour * 60 + now.minute
    diff = now_min - _to_minutes(send_hhmm)
    return 0 <= diff < WINDOW_MINUTES


async def main(kind: str, force: bool) -> None:
    mode = "KIRIM" if settings.WA_ENABLED and settings.WA_GATEWAY_URL else "DRY-RUN (tak mengirim)"
    print(f"== Broadcast [{kind}] — mode: {mode}{' (FORCE)' if force else ''} ==")
    async with AsyncSessionLocal() as db:
        studio = await get_studio(db)
        if not studio.wa_broadcast_enabled:
            print("Broadcast WhatsApp DIMATIKAN di Pengaturan — no-op.")
            return

        send_time = studio.dropin_open_time if kind == "dropin" else studio.bulanan_open_time
        if not force and not _within_window(send_time):
            print(f"Belum jam kirim (setting {send_time} WITA, sekarang {now_local():%H:%M}) — no-op.")
            return

        today = today_local()
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
    p.add_argument("--force", action="store_true", help="kirim sekarang tanpa cek jam setting")
    a = p.parse_args()
    asyncio.run(main(a.kind, a.force))
