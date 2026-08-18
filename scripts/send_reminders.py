"""
Kirim pengingat WhatsApp.
  --kind h1  (default) : H-1, sehari sebelum, untuk semua kelas besok
  --kind h2            : ±2 jam sebelum kelas mulai (kelas dalam window itu)

Idempoten — aman dijalankan berulang (tak dobel kirim).

Contoh:
    docker compose -f docker-compose.prod.yml exec -T backend python -m scripts.send_reminders            # h1
    docker compose ... exec -T backend python -m scripts.send_reminders --kind h2
    docker compose ... exec -T backend python -m scripts.send_reminders --kind h2 --force

Butuh WA_ENABLED=true + gateway terkonfigurasi agar benar-benar mengirim (jika tidak → DRY-RUN).
"""
import argparse
import asyncio

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.reminders import run_reminder_pass, run_expiry_reminders


async def main(kind: str, force: bool) -> None:
    mode = "KIRIM" if settings.WA_ENABLED and settings.WA_GATEWAY_URL else "DRY-RUN (tak mengirim)"
    label = {"h1": "H-1 (besok)", "expiry": "H-1 kedaluwarsa paket bulanan"}.get(kind, f"H-{settings.REMINDER_HOURS_BEFORE}jam (mulai sebentar lagi)")
    print(f"== Reminder WA [{label}] — mode: {mode} ==")
    async with AsyncSessionLocal() as db:
        res = await (run_expiry_reminders(db, force=force) if kind == "expiry" else run_reminder_pass(db, kind=kind, force=force))
        await db.commit()
    print(f"Terkirim: {res['sent']} | Dilewati: {res['skipped']} | Gagal: {res['failed']}")
    for line in res["detail"]:
        print("  -", line)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--kind", choices=["h1", "h2", "expiry"], default="h1")
    p.add_argument("--force", action="store_true", help="kirim ulang walau sudah pernah")
    a = p.parse_args()
    asyncio.run(main(a.kind, a.force))
