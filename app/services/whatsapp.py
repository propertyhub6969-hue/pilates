"""
Adapter pengiriman WhatsApp lewat gateway gowa (go-whatsapp-web-multidevice).

Aman secara default: bila WA_ENABLED=False atau gateway belum dikonfigurasi,
fungsi hanya me-log (dry-run) dan tak mengirim apa pun.
"""
import re
import base64
import httpx
from app.core.config import settings


def normalize_phone(phone: str) -> str | None:
    """Normalisasi nomor Indonesia ke format 62xxxxxxxxxx (tanpa +, spasi, dsb)."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("620"):
        digits = "62" + digits[3:]
    elif not digits.startswith("62"):
        # asumsikan sudah nomor lokal tanpa 0 (mis. 81234...) → prefiks 62
        digits = "62" + digits
    return digits


async def send_whatsapp(phone: str, message: str) -> tuple[bool, str]:
    """Kirim satu pesan WA. Return (terkirim, keterangan).
    Dry-run bila WA_ENABLED=False / gateway belum diset."""
    num = normalize_phone(phone)
    if not num:
        return False, "nomor tidak valid"

    if not settings.WA_ENABLED or not settings.WA_GATEWAY_URL:
        return False, f"DRY-RUN (tak terkirim) → {num}"

    headers = {}
    if settings.WA_BASIC_AUTH:
        token = base64.b64encode(settings.WA_BASIC_AUTH.encode()).decode()
        headers["Authorization"] = f"Basic {token}"
    if settings.WA_DEVICE_ID:
        # gowa multi-akun: tiap kirim wajib menyertakan device (akun WA) yang dipakai
        headers["X-Device-Id"] = settings.WA_DEVICE_ID

    url = settings.WA_GATEWAY_URL.rstrip("/") + "/send/message"
    payload = {"phone": num, "message": message}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code // 100 == 2:
            return True, "terkirim"
        return False, f"gateway HTTP {resp.status_code}: {resp.text[:120]}"
    except Exception as e:  # noqa: BLE001
        return False, f"error: {e}"
