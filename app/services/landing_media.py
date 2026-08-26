"""Penyimpanan gambar landing page (hero, foto kelas, dll).

Disimpan sebagai file per-slot di /app/uploads/landing/{slot}.{ext} (volume persist),
tanpa kolom DB — cukup cek keberadaan file. Disajikan publik lewat
GET /api/v1/public/media/{slot}. Upload/hapus hanya staf (studio.py).
"""
import glob
import os

LANDING_DIR = "/app/uploads/landing"

# content-type yang diterima → ekstensi file
ALLOWED_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB

# Slot gambar yang dikenal di landing page.
SLOTS = {"hero", "about", "class1", "class2", "class3"}


def path_for_slot(slot: str) -> str | None:
    """Path file tersimpan untuk sebuah slot (ekstensi apa pun), atau None."""
    matches = sorted(glob.glob(os.path.join(LANDING_DIR, f"{slot}.*")))
    return matches[0] if matches else None


def present_slots() -> dict[str, str]:
    """{slot: url-publik-dengan-cache-buster} untuk slot yang punya gambar."""
    out: dict[str, str] = {}
    for slot in SLOTS:
        p = path_for_slot(slot)
        if p:
            try:
                ver = int(os.path.getmtime(p))
            except OSError:
                ver = 0
            out[slot] = f"/api/v1/public/media/{slot}?v={ver}"
    return out


def remove_slot(slot: str) -> None:
    """Hapus semua file untuk slot (ekstensi apa pun)."""
    for old in glob.glob(os.path.join(LANDING_DIR, f"{slot}.*")):
        try:
            os.remove(old)
        except OSError:
            pass


def save_slot(slot: str, ext: str, data: bytes) -> None:
    """Simpan gambar slot, ganti versi lama."""
    os.makedirs(LANDING_DIR, exist_ok=True)
    remove_slot(slot)
    with open(os.path.join(LANDING_DIR, f"{slot}{ext}"), "wb") as fh:
        fh.write(data)
