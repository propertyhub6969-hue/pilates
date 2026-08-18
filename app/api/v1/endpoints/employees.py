import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import require_owner
from app.models.user import User
from app.models.employee import Employee, PayrollEntry, PayrollStatus
from app.models.finance import FinancialAccount, Expense
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeRow,
    PayrollCreate, PayrollUpdate, PayrollPay, PayrollGenerate, PayrollRow,
)

router = APIRouter()


# ── Data Karyawan ──
@router.get("", response_model=list[EmployeeRow])
async def list_employees(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_owner),
):
    stmt = select(Employee)
    if active_only:
        stmt = stmt.where(Employee.is_active.is_(True))
    rows = (await db.execute(stmt.order_by(Employee.is_active.desc(), Employee.name.asc()))).scalars().all()
    return rows


@router.post("", response_model=EmployeeRow, status_code=201)
async def create_employee(payload: EmployeeCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    emp = Employee(**payload.model_dump())
    db.add(emp)
    await db.flush()
    await db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeRow)
async def update_employee(employee_id: uuid.UUID, payload: EmployeeUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(emp, k, v)
    await db.flush()
    await db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(employee_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    """Non-aktifkan karyawan (riwayat payroll tetap tersimpan)."""
    emp = (await db.execute(select(Employee).where(Employee.id == employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    emp.is_active = False
    return None


# ── Payroll ──
async def _payroll_rows(db: AsyncSession, period: str | None = None, status: PayrollStatus | None = None) -> list[PayrollRow]:
    stmt = (
        select(PayrollEntry, FinancialAccount.name)
        .outerjoin(FinancialAccount, PayrollEntry.account_id == FinancialAccount.id)
        .order_by(PayrollEntry.period.desc(), PayrollEntry.employee_name.asc())
    )
    if period:
        stmt = stmt.where(PayrollEntry.period == period)
    if status:
        stmt = stmt.where(PayrollEntry.status == status)
    rows = (await db.execute(stmt)).all()
    out = []
    for e, acc_name in rows:
        r = PayrollRow.model_validate(e)
        r.account_name = acc_name
        out.append(r)
    return out


@router.get("/payroll", response_model=list[PayrollRow])
async def list_payroll(
    period: str | None = Query(None),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_owner),
):
    return await _payroll_rows(db, period)


@router.post("/payroll/generate", response_model=list[PayrollRow])
async def generate_payroll(payload: PayrollGenerate, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    """Buat baris payroll DRAFT untuk semua karyawan aktif yang belum punya baris di periode ini."""
    emps = (await db.execute(select(Employee).where(Employee.is_active.is_(True)))).scalars().all()
    existing = set(
        (await db.execute(select(PayrollEntry.employee_id).where(PayrollEntry.period == payload.period))).scalars().all()
    )
    for e in emps:
        if e.id in existing:
            continue
        db.add(PayrollEntry(
            employee_id=e.id, employee_name=e.name, period=payload.period,
            amount=e.base_salary or 0, status=PayrollStatus.DRAFT,
        ))
    await db.flush()
    return await _payroll_rows(db, payload.period)


@router.post("/payroll", response_model=PayrollRow, status_code=201)
async def create_payroll(payload: PayrollCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    emp = (await db.execute(select(Employee).where(Employee.id == payload.employee_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "Karyawan tidak ditemukan")
    entry = PayrollEntry(
        employee_id=emp.id, employee_name=emp.name, period=payload.period,
        amount=payload.amount, note=payload.note, status=PayrollStatus.DRAFT,
    )
    db.add(entry)
    await db.flush()
    rows = await _payroll_rows(db, payload.period)
    return next(r for r in rows if r.id == entry.id)


@router.patch("/payroll/{entry_id}", response_model=PayrollRow)
async def update_payroll(entry_id: uuid.UUID, payload: PayrollUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    entry = (await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Baris payroll tidak ditemukan")
    if entry.status == PayrollStatus.PAID:
        raise HTTPException(400, "Payroll sudah dibayar — tak bisa diubah. Hapus dulu bila keliru.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.flush()
    rows = await _payroll_rows(db)
    return next(r for r in rows if r.id == entry.id)


@router.post("/payroll/{entry_id}/pay", response_model=PayrollRow)
async def pay_payroll(entry_id: uuid.UUID, payload: PayrollPay, db: AsyncSession = Depends(get_db), actor: User = Depends(require_owner)):
    """Bayar gaji → tandai PAID + buat Pengeluaran kategori 'gaji' (masuk laba/rugi & buku besar)."""
    entry = (await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Baris payroll tidak ditemukan")
    if entry.status == PayrollStatus.PAID:
        raise HTTPException(400, "Payroll sudah dibayar")
    acc = (await db.execute(select(FinancialAccount).where(FinancialAccount.id == payload.account_id))).scalar_one_or_none()
    if not acc:
        raise HTTPException(400, "Akun pembayar tidak ditemukan")
    exp = Expense(
        expense_date=payload.paid_date, category="gaji", amount=entry.amount,
        account_id=acc.id, description=f"Gaji {entry.employee_name} — {entry.period}",
        recorded_by_id=actor.id,
    )
    db.add(exp)
    await db.flush()
    entry.status = PayrollStatus.PAID
    entry.paid_date = payload.paid_date
    entry.account_id = acc.id
    entry.expense_id = exp.id
    await db.flush()
    rows = await _payroll_rows(db)
    return next(r for r in rows if r.id == entry.id)


@router.delete("/payroll/{entry_id}", status_code=204)
async def delete_payroll(entry_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_owner)):
    """Hapus baris payroll. Bila sudah dibayar, Pengeluaran gaji terkait ikut dihapus."""
    entry = (await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))).scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Baris payroll tidak ditemukan")
    if entry.expense_id:
        exp = (await db.execute(select(Expense).where(Expense.id == entry.expense_id))).scalar_one_or_none()
        if exp:
            await db.delete(exp)
    await db.delete(entry)
    return None
