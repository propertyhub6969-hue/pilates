"""
Adapter pengiriman WhatsApp lewat gateway gowa (go-whatsapp-web-multidevice).

Aman secara default: bila WA_ENABLED=False atau gateway belum dikonfigurasi,
fungsi hanya me-log (dry-run) dan tak mengirim apa pun.
"""
import re
import base64
import httpx
from app.core.config import settings


def _auth_headers() -> dict:
    h = {}
    if settings.WA_BASIC_AUTH:
        token = base64.b64encode(settings.WA_BASIC_AUTH.encode()).decode()
        h["Authorization"] = f"Basic {token}"
    return h


# Cache device id yg sedang login (agar tak query /devices tiap kirim)
_cached_device: str | None = None


async def resolve_device_id() -> str | None:
    """Cari id device gowa yang state-nya logged_in. Jika WA_DEVICE_ID diisi id spesifik
    (bukan 'auto'), pakai itu. Auto-deteksi lebih tahan re-scan (id UUID berubah)."""
    global _cached_device
    if settings.WA_DEVICE_ID and settings.WA_DEVICE_ID != "auto":
        return settings.WA_DEVICE_ID
    if _cached_device:
        return _cached_device
    if not settings.WA_GATEWAY_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(settings.WA_GATEWAY_URL.rstrip("/") + "/devices", headers=_auth_headers())
        data = resp.json().get("results", []) or []
        for dev in data:
            if dev.get("state") == "logged_in":
                _cached_device = dev.get("id")
                return _cached_device
    except Exception:  # noqa: BLE001
        return None
    return None


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

    headers = _auth_headers()
    device_id = await resolve_device_id()
    if not device_id:
        return False, "tidak ada device WhatsApp yang login di gateway"
    # gowa multi-akun: tiap kirim wajib menyertakan device (akun WA) yang dipakai
    headers["X-Device-Id"] = device_id

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
