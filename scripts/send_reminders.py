"""
Kirim pengingat WhatsApp H-1 untuk kelas besok (atau tanggal tertentu).
Idempoten — aman dijalankan berulang (tak dobel kirim).

Contoh:
    # sekali jalan (besok):
    docker compose -f docker-compose.prod.yml exec -T backend python -m scripts.send_reminders
    # tanggal tertentu:
    docker compose ... exec -T backend python -m scripts.send_reminders --date 2026-08-20
    # paksa kirim ulang:
    docker compose ... exec -T backend python -m scripts.send_reminders --force

Butuh WA_ENABLED=true + WA_GATEWAY_URL + WA_BASIC_AUTH di .env agar benar-benar mengirim.
Tanpa itu → DRY-RUN (hanya menampilkan siapa yang akan diingatkan).
"""
import argparse
import asyncio
from datetime import date

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.reminders import run_reminder_pass


async def main(target: date | None, force: bool) -> None:
    mode = "KIRIM" if settings.WA_ENABLED and settings.WA_GATEWAY_URL else "DRY-RUN (tak mengirim)"
    print(f"== Reminder WA — mode: {mode} ==")
    async with AsyncSessionLocal() as db:
        res = await run_reminder_pass(db, target_date=target, force=force)
        await db.commit()
    print(f"Tanggal: {res['target_date']}")
    print(f"Terkirim: {res['sent']} | Dilewati: {res['skipped']} | Gagal: {res['failed']}")
    for line in res["detail"]:
        print("  -", line)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--date", help="YYYY-MM-DD (default: besok)")
    p.add_argument("--force", action="store_true", help="kirim ulang walau sudah pernah")
    a = p.parse_args()
    target = date.fromisoformat(a.date) if a.date else None
    asyncio.run(main(target, a.force))
