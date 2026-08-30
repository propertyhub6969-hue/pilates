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


async def resolve_device_id() -> str | None:
    """Cari id device gowa yang state-nya logged_in. Jika WA_DEVICE_ID diisi id spesifik
    (bukan 'auto'), pakai itu. ★ TIDAK di-cache: selalu ambil device terbaru dari /devices
    agar tahan scan-ulang (id UUID berubah tiap re-pair; cache lama → DEVICE_NOT_FOUND)."""
    if settings.WA_DEVICE_ID and settings.WA_DEVICE_ID != "auto":
        return settings.WA_DEVICE_ID
    if not settings.WA_GATEWAY_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(settings.WA_GATEWAY_URL.rstrip("/") + "/devices", headers=_auth_headers())
        data = resp.json().get("results", []) or []
        for dev in data:
            if dev.get("state") == "logged_in":
                return dev.get("id")
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


async def phone_taken(db, phone: str | None, exclude_id=None) -> bool:
    """True bila nomor (setelah normalisasi) sudah dipakai user lain.
    exclude_id = abaikan user ini sendiri (untuk kasus update)."""
    target = normalize_phone(phone or "")
    if not target:
        return False
    from sqlalchemy import select
    from app.models.user import User
    rows = (await db.execute(select(User.id, User.phone).where(User.phone.isnot(None)))).all()
    for uid, ph in rows:
        if exclude_id is not None and uid == exclude_id:
            continue
        if normalize_phone(ph or "") == target:
            return True
    return False


async def _post_message(target: str, message: str) -> tuple[bool, str]:
    """Kirim ke `target` (nomor 62xxx utk personal, atau JID `...@g.us` utk grup)."""
    if not settings.WA_ENABLED or not settings.WA_GATEWAY_URL:
        return False, f"DRY-RUN (tak terkirim) → {target}"
    headers = _auth_headers()
    device_id = await resolve_device_id()
    if not device_id:
        return False, "tidak ada device WhatsApp yang login di gateway"
    headers["X-Device-Id"] = device_id  # gowa multi-akun: wajib device yang dipakai
    url = settings.WA_GATEWAY_URL.rstrip("/") + "/send/message"
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(url, json={"phone": target, "message": message}, headers=headers)
        if resp.status_code // 100 == 2:
            return True, "terkirim"
        return False, f"gateway HTTP {resp.status_code}: {resp.text[:120]}"
    except Exception as e:  # noqa: BLE001
        return False, f"error: {e}"


async def send_whatsapp(phone: str, message: str) -> tuple[bool, str]:
    """Kirim satu pesan WA ke nomor personal. Dry-run bila WA_ENABLED=False."""
    num = normalize_phone(phone)
    if not num:
        return False, "nomor tidak valid"
    return await _post_message(num, message)


async def notify_admin(db, message: str) -> tuple[bool, str]:
    """Kirim notif WA ke admin studio (StudioSettings.admin_whatsapp, fallback nomor owner).
    Best-effort: no-op bila tak ada tujuan. ★ Bila admin_whatsapp = nomor gateway (sama),
    WA anggap pesan-ke-diri-sendiri → tak ada notif; set admin_whatsapp ke nomor BERBEDA."""
    from sqlalchemy import select
    from app.models.studio import StudioSettings
    from app.models.user import User, UserRole
    studio = (await db.execute(select(StudioSettings))).scalars().first()
    target = studio.admin_whatsapp if studio else None
    if not target:
        target = (
            await db.execute(
                select(User.phone).where(User.role == UserRole.OWNER, User.phone.isnot(None)).limit(1)
            )
        ).scalar_one_or_none()
    if not target:
        return False, "tak ada tujuan admin"
    return await send_whatsapp(target, message)


async def send_whatsapp_group(group_jid: str, message: str) -> tuple[bool, str]:
    """Kirim pesan ke GRUP (JID `...@g.us`). Risiko rendah: 1 pesan, aktivitas grup normal."""
    if not group_jid:
        return False, "grup belum dipilih"
    if "@g.us" not in group_jid:
        group_jid = f"{group_jid}@g.us"
    return await _post_message(group_jid, message)


async def list_wa_groups() -> list[dict]:
    """Daftar grup yang diikuti akun WA (utk dipilih di Pengaturan). Return [{jid, name}]."""
    if not settings.WA_GATEWAY_URL:
        return []
    device_id = await resolve_device_id()
    if not device_id:
        return []
    headers = _auth_headers()
    headers["X-Device-Id"] = device_id
    base = settings.WA_GATEWAY_URL.rstrip("/")
    for path in ("/user/my/groups", "/group"):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(base + path, headers=headers)
            if resp.status_code // 100 != 2:
                continue
            results = resp.json().get("results")
            rows = results.get("data", results) if isinstance(results, dict) else results
            out = []
            for g in (rows or []):
                jid = g.get("JID") or g.get("jid") or g.get("id")
                name = g.get("Name") or g.get("name") or g.get("subject") or "(tanpa nama)"
                if jid:
                    out.append({"jid": jid, "name": name})
            if out:
                return out
        except Exception:  # noqa: BLE001
            continue
    return []
