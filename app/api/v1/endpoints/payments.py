import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import require_staff
from app.models.user import User
from app.models.payment import Payment, PaymentStatus
from app.models.package import MemberPackage
from app.schemas.common import Page
from app.schemas.payment import PaymentRow, PaymentStatusUpdate

router = APIRouter()


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
    pay.paid_at = datetime.now(timezone.utc) if payload.status == PaymentStatus.PAID else pay.paid_at
    await db.flush()
    await db.refresh(pay)
    return PaymentRow.model_validate(pay)
