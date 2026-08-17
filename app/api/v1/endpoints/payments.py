import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff, get_current_user
from app.models.user import User
from app.models.payment import Payment, PaymentStatus
from app.models.package import MemberPackage
from app.schemas.common import Page
from app.schemas.payment import PaymentRow, PaymentStatusUpdate

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
PROOF_DIR = os.path.join(UPLOAD_DIR, "proofs")
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MB


@router.get("", response_model=Page[PaymentRow])
async def list_payments(
    status: PaymentStatus | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    stmt = (
        select(Payment, User.full_name, MemberPackage.package_name)
        .join(User, Payment.member_id == User.id)
        .outerjoin(MemberPackage, Payment.member_package_id == MemberPackage.id)
    )
    if status:
        stmt = stmt.where(Payment.status == status)

    count_stmt = select(func.count()).select_from(Payment)
    if status:
        count_stmt = count_stmt.where(Payment.status == status)
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (await db.execute(stmt.order_by(Payment.created_at.desc()).limit(limit).offset(offset))).all()
    items = []
    for pay, member_name, package_name in rows:
        row = PaymentRow.model_validate(pay)
        row.member_name = member_name
        row.package_name = package_name
        row.has_proof = bool(pay.proof_path)
        items.append(row)
    return Page(items=items, total=total)


@router.patch("/{payment_id}", response_model=PaymentRow)
async def update_payment_status(
    payment_id: uuid.UUID,
    payload: PaymentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    """Verifikasi pembayaran pending → paid, atau tandai refunded."""
    pay = (await db.execute(select(Payment).where(Payment.id == payment_id))).scalar_one_or_none()
    if not pay:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    pay.status = payload.status
    if payload.status == PaymentStatus.PAID:
        pay.paid_at = datetime.now(timezone.utc)
        if pay.account_id is None:  # atribusikan ke akun kas/bank sesuai metode
            from app.services.finance import resolve_income_account
            pay.account_id = await resolve_income_account(db, pay.method)
    await db.flush()
    await db.refresh(pay)
    row = PaymentRow.model_validate(pay)
    row.has_proof = bool(pay.proof_path)
    return row


@router.post("/{payment_id}/proof")
async def upload_proof(
    payment_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Unggah bukti transfer. Member hanya utk pembayarannya sendiri; staf bebas."""
    pay = (await db.execute(select(Payment).where(Payment.id == payment_id))).scalar_one_or_none()
    if not pay:
        raise HTTPException(404, "Pembayaran tidak ditemukan")
    if pay.member_id != user.id and not user.is_staff():
        raise HTTPException(403, "Tidak boleh mengunggah bukti pembayaran orang lain")

    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Format tidak didukung. Unggah gambar (JPG/PNG/WebP) atau PDF.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Ukuran file maksimal 8 MB")

    os.makedirs(PROOF_DIR, exist_ok=True)
    fname = f"{payment_id}{ext}"
    with open(os.path.join(PROOF_DIR, fname), "wb") as f:
        f.write(data)
    pay.proof_path = f"proofs/{fname}"
    await db.flush()
    return {"ok": True, "has_proof": True}


@router.get("/{payment_id}/proof")
async def view_proof(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lihat bukti transfer (staf atau pemilik pembayaran)."""
    pay = (await db.execute(select(Payment).where(Payment.id == payment_id))).scalar_one_or_none()
    if not pay or not pay.proof_path:
        raise HTTPException(404, "Bukti tidak ditemukan")
    if pay.member_id != user.id and not user.is_staff():
        raise HTTPException(403, "Akses ditolak")
    full = os.path.join(UPLOAD_DIR, pay.proof_path)
    if not os.path.exists(full):
        raise HTTPException(404, "File bukti hilang")
    return FileResponse(full)
