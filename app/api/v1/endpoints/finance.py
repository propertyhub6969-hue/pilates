import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.api.deps import require_staff, get_current_user
from app.models.user import User
from app.models.finance import FinancialAccount, AccountType, Expense, ExpenseCategory, ExpenseEdit, CATEGORY_LABEL
from app.models.payment import Payment, PaymentStatus
from app.schemas.common import Page
from app.schemas.finance import (
    AccountCreate, AccountUpdate, AccountResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseRow, ExpenseEditRow,
    FinanceReport, CategoryAmount, LedgerEntry, LedgerResponse,
)
from app.services.finance import account_balance

router = APIRouter()


def _fmt_rp(v) -> str:
    return f"Rp{int(round(float(v or 0))):,}".replace(",", ".")


def _fmt_date(d) -> str:
    return f"{d.day:02d}/{d.month:02d}/{d.year}" if d else "—"


class TransferAccount(BaseModel):
    name: str
    bank_name: Optional[str] = None
    account_number: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/transfer-info", response_model=list[TransferAccount])
async def transfer_info(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Rekening bank aktif untuk instruksi transfer (dilihat member saat bayar)."""
    rows = (
        await db.execute(
            select(FinancialAccount).where(
                FinancialAccount.is_active.is_(True), FinancialAccount.type == AccountType.BANK
            ).order_by(FinancialAccount.created_at)
        )
    ).scalars().all()
    return rows


# ─────────────── AKUN KAS/BANK ───────────────
async def _account_out(db: AsyncSession, acc: FinancialAccount) -> AccountResponse:
    r = AccountResponse.model_validate(acc)
    r.balance = await account_balance(db, acc)
    return r


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    stmt = select(FinancialAccount)
    if not include_inactive:
        stmt = stmt.where(FinancialAccount.is_active.is_(True))
    rows = (await db.execute(stmt.order_by(FinancialAccount.type, FinancialAccount.created_at))).scalars().all()
    return [await _account_out(db, a) for a in rows]


@router.post("/accounts", response_model=AccountResponse, status_code=201)
async def create_account(payload: AccountCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    acc = FinancialAccount(**payload.model_dump())
    db.add(acc)
    await db.flush()
    await db.refresh(acc)
    return await _account_out(db, acc)


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(account_id: uuid.UUID, payload: AccountUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    acc = (await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))).scalar_one_or_none()
    if not acc:
        raise HTTPException(404, "Akun tidak ditemukan")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(acc, k, v)
    await db.flush()
    await db.refresh(acc)
    return await _account_out(db, acc)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    """Non-aktifkan akun (data pengeluaran/income tetap tersimpan)."""
    acc = (await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))).scalar_one_or_none()
    if not acc:
        raise HTTPException(404, "Akun tidak ditemukan")
    acc.is_active = False
    return None


async def _build_ledger(db: AsyncSession, account_id: uuid.UUID, date_from, date_to) -> LedgerResponse:
    """Buku besar akun: mutasi masuk (pembayaran lunas) & keluar (pengeluaran) + saldo berjalan.
    Dihitung dari SELURUH riwayat sejak saldo awal agar rekonsiliasi dgn saldo akun."""
    acc = (await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))).scalar_one_or_none()
    if not acc:
        raise HTTPException(404, "Akun tidak ditemukan")

    # Uang masuk = pembayaran LUNAS yang ter-atribusi ke akun ini
    inc_rows = (
        await db.execute(
            select(
                Payment.amount, func.coalesce(Payment.paid_at, Payment.created_at), Payment.note, User.full_name
            ).outerjoin(User, Payment.member_id == User.id)
            .where(Payment.account_id == account_id, Payment.status == PaymentStatus.PAID)
        )
    ).all()
    # Uang keluar = pengeluaran dari akun ini
    exp_rows = (
        await db.execute(
            select(Expense.amount, Expense.expense_date, Expense.category, Expense.description)
            .where(Expense.account_id == account_id)
        )
    ).all()

    events = []  # (sort_key_datetime, date, kind, description, amount)
    for amount, ts, note, member_name in inc_rows:
        d = ts.date()
        label = note or "Pembayaran"
        if member_name:
            label = f"{label} — {member_name}"
        events.append((ts.replace(tzinfo=None), d, "in", label, float(amount or 0)))
    for amount, edate, category, description in exp_rows:
        label = CATEGORY_LABEL.get(category.value, category.value)
        if description:
            label = f"{label} — {description}"
        events.append((datetime(edate.year, edate.month, edate.day), edate, "out", label, float(amount or 0)))

    events.sort(key=lambda e: e[0])

    opening = float(acc.opening_balance or 0)
    running = opening
    starting_balance = opening
    entries: list[LedgerEntry] = []
    total_in = 0.0
    total_out = 0.0
    for _sk, d, kind, label, amount in events:
        if kind == "in":
            running += amount
        else:
            running -= amount
        # sebelum periode → hanya update saldo awal periode, tidak ditampilkan
        if date_from and d < date_from:
            starting_balance = running
            continue
        if date_to and d > date_to:
            continue
        if kind == "in":
            total_in += amount
        else:
            total_out += amount
        entries.append(LedgerEntry(date=d, kind=kind, description=label, amount=amount, balance=running))

    ending_balance = entries[-1].balance if entries else starting_balance
    return LedgerResponse(
        account_id=acc.id, account_name=acc.name, account_type=acc.type,
        opening_balance=opening, starting_balance=starting_balance,
        total_in=total_in, total_out=total_out, ending_balance=ending_balance,
        entries=entries,
    )


@router.get("/accounts/{account_id}/ledger", response_model=LedgerResponse)
async def account_ledger(
    account_id: uuid.UUID,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    return await _build_ledger(db, account_id, date_from, date_to)


@router.get("/accounts/{account_id}/ledger.xlsx")
async def account_ledger_xlsx(
    account_id: uuid.UUID,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    """Ekspor buku besar akun ke Excel (.xlsx)."""
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from fastapi.responses import StreamingResponse

    data = await _build_ledger(db, account_id, date_from, date_to)

    wb = Workbook()
    ws = wb.active
    ws.title = "Buku Besar"

    copper = "8A5140"
    head_fill = PatternFill("solid", fgColor="F0E0D6")
    money = "#,##0"
    thin = Side(style="thin", color="E5D5CB")
    border = Border(bottom=thin)

    ws.merge_cells("A1:E1")
    c = ws["A1"]; c.value = f"Buku Besar — {data.account_name}"
    c.font = Font(bold=True, size=14, color=copper)
    ws.merge_cells("A2:E2")
    periode = f"Periode {date_from.strftime('%d/%m/%Y') if date_from else 'awal'} – {date_to.strftime('%d/%m/%Y') if date_to else 'kini'}"
    ws["A2"].value = periode
    ws["A2"].font = Font(size=10, color="888888")

    headers = ["Tanggal", "Keterangan", "Masuk", "Keluar", "Saldo"]
    hr = 4
    for i, h in enumerate(headers, start=1):
        cell = ws.cell(row=hr, column=i, value=h)
        cell.font = Font(bold=True, color=copper)
        cell.fill = head_fill
        cell.alignment = Alignment(horizontal="right" if i >= 3 else "left")

    r = hr + 1
    # baris saldo awal periode
    ws.cell(row=r, column=1, value=(date_from.strftime("%d/%m/%Y") if date_from else ""))
    ws.cell(row=r, column=2, value="Saldo awal periode").font = Font(italic=True)
    sc = ws.cell(row=r, column=5, value=float(data.starting_balance)); sc.number_format = money
    for col in range(1, 6):
        ws.cell(row=r, column=col).fill = head_fill
    r += 1

    for e in data.entries:
        ws.cell(row=r, column=1, value=e.date.strftime("%d/%m/%Y"))
        ws.cell(row=r, column=2, value=e.description)
        if e.kind == "in":
            ic = ws.cell(row=r, column=3, value=float(e.amount)); ic.number_format = money
        else:
            oc = ws.cell(row=r, column=4, value=float(e.amount)); oc.number_format = money
        bc = ws.cell(row=r, column=5, value=float(e.balance)); bc.number_format = money
        for col in range(1, 6):
            ws.cell(row=r, column=col).border = border
        r += 1

    # ringkasan
    r += 1
    ws.cell(row=r, column=2, value="Total Masuk").font = Font(bold=True)
    tc = ws.cell(row=r, column=3, value=float(data.total_in)); tc.number_format = money; tc.font = Font(bold=True)
    r += 1
    ws.cell(row=r, column=2, value="Total Keluar").font = Font(bold=True)
    oc = ws.cell(row=r, column=4, value=float(data.total_out)); oc.number_format = money; oc.font = Font(bold=True)
    r += 1
    ws.cell(row=r, column=2, value="Saldo Akhir").font = Font(bold=True, color=copper)
    ec = ws.cell(row=r, column=5, value=float(data.ending_balance)); ec.number_format = money; ec.font = Font(bold=True, color=copper)

    widths = [14, 46, 16, 16, 18]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    safe = "".join(ch for ch in data.account_name if ch.isalnum() or ch in " -_").strip().replace(" ", "_")
    fname = f"BukuBesar_{safe or 'akun'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ─────────────── PENGELUARAN ───────────────
@router.get("/expenses", response_model=Page[ExpenseRow])
async def list_expenses(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    category: ExpenseCategory | None = Query(None),
    account_id: uuid.UUID | None = Query(None),
    limit: int = Query(20, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    edit_count_sq = (
        select(func.count(ExpenseEdit.id)).where(ExpenseEdit.expense_id == Expense.id).scalar_subquery()
    )
    stmt = select(Expense, FinancialAccount.name, edit_count_sq).outerjoin(FinancialAccount, Expense.account_id == FinancialAccount.id)
    conds = []
    if date_from:
        conds.append(Expense.expense_date >= date_from)
    if date_to:
        conds.append(Expense.expense_date <= date_to)
    if category:
        conds.append(Expense.category == category)
    if account_id:
        conds.append(Expense.account_id == account_id)
    for c in conds:
        stmt = stmt.where(c)

    count_stmt = select(func.count()).select_from(Expense)
    for c in conds:
        count_stmt = count_stmt.where(c)
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (await db.execute(stmt.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).limit(limit).offset(offset))).all()
    items = []
    for exp, acc_name, ecount in rows:
        row = ExpenseRow.model_validate(exp)
        row.account_name = acc_name
        row.edit_count = ecount or 0
        items.append(row)
    return Page(items=items, total=total)


@router.post("/expenses", response_model=ExpenseRow, status_code=201)
async def create_expense(payload: ExpenseCreate, db: AsyncSession = Depends(get_db), staff: User = Depends(require_staff)):
    acc = (await db.execute(select(FinancialAccount).where(FinancialAccount.id == payload.account_id))).scalar_one_or_none()
    if not acc:
        raise HTTPException(400, "Akun tidak valid")
    exp = Expense(**payload.model_dump(), recorded_by_id=staff.id)
    db.add(exp)
    await db.flush()
    await db.refresh(exp)
    row = ExpenseRow.model_validate(exp)
    row.account_name = acc.name
    return row


async def _account_name(db: AsyncSession, account_id) -> str:
    if not account_id:
        return "—"
    name = (await db.execute(select(FinancialAccount.name).where(FinancialAccount.id == account_id))).scalar_one_or_none()
    return name or "—"


@router.patch("/expenses/{expense_id}", response_model=ExpenseRow)
async def update_expense(expense_id: uuid.UUID, payload: ExpenseUpdate, db: AsyncSession = Depends(get_db), staff: User = Depends(require_staff)):
    exp = (await db.execute(select(Expense).where(Expense.id == expense_id))).scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Pengeluaran tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)
    changes: list[str] = []
    for field, new_val in data.items():
        old_val = getattr(exp, field)
        if field == "amount":
            if float(old_val) == float(new_val):
                continue
            changes.append(f"Jumlah: {_fmt_rp(old_val)} → {_fmt_rp(new_val)}")
        elif field == "category":
            if old_val == new_val:
                continue
            changes.append(f"Kategori: {CATEGORY_LABEL.get(old_val.value, old_val.value)} → {CATEGORY_LABEL.get(new_val.value, new_val.value)}")
        elif field == "expense_date":
            if old_val == new_val:
                continue
            changes.append(f"Tanggal: {_fmt_date(old_val)} → {_fmt_date(new_val)}")
        elif field == "account_id":
            if old_val == new_val:
                continue
            changes.append(f"Akun: {await _account_name(db, old_val)} → {await _account_name(db, new_val)}")
        elif field == "description":
            if (old_val or "") == (new_val or ""):
                continue
            changes.append(f"Keterangan: {old_val or '—'} → {new_val or '—'}")
        setattr(exp, field, new_val)

    if changes:
        db.add(ExpenseEdit(
            expense_id=exp.id, edited_by_id=staff.id, edited_by_name=staff.full_name,
            summary="; ".join(changes),
        ))

    await db.flush()
    await db.refresh(exp)
    ecount = (await db.execute(select(func.count(ExpenseEdit.id)).where(ExpenseEdit.expense_id == exp.id))).scalar_one()
    row = ExpenseRow.model_validate(exp)
    row.account_name = await _account_name(db, exp.account_id) if exp.account_id else None
    row.edit_count = ecount or 0
    return row


@router.get("/expenses/{expense_id}/history", response_model=list[ExpenseEditRow])
async def expense_history(expense_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    rows = (
        await db.execute(
            select(ExpenseEdit).where(ExpenseEdit.expense_id == expense_id).order_by(ExpenseEdit.created_at.desc())
        )
    ).scalars().all()
    return rows


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(expense_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(require_staff)):
    exp = (await db.execute(select(Expense).where(Expense.id == expense_id))).scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Pengeluaran tidak ditemukan")
    await db.delete(exp)
    return None


# ─────────────── LAPORAN KEUANGAN ───────────────
@router.get("/report", response_model=FinanceReport)
async def finance_report(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    db: AsyncSession = Depends(get_db), _: User = Depends(require_staff),
):
    # Income = pembayaran LUNAS pada rentang (pakai created_at tanggalnya)
    income = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.status == PaymentStatus.PAID,
                func.date(Payment.created_at) >= date_from,
                func.date(Payment.created_at) <= date_to,
            )
        )
    ).scalar_one()

    in_range = (Expense.expense_date >= date_from) & (Expense.expense_date <= date_to)
    expense = (await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(in_range))).scalar_one()

    cat_rows = (
        await db.execute(
            select(Expense.category, func.coalesce(func.sum(Expense.amount), 0)).where(in_range).group_by(Expense.category)
        )
    ).all()
    by_cat = [CategoryAmount(category=c, amount=float(a or 0)) for c, a in cat_rows]

    accounts = (
        await db.execute(select(FinancialAccount).where(FinancialAccount.is_active.is_(True)).order_by(FinancialAccount.type, FinancialAccount.created_at))
    ).scalars().all()
    acc_out = [await _account_out(db, a) for a in accounts]

    return FinanceReport(
        date_from=date_from, date_to=date_to,
        income=float(income or 0), expense=float(expense or 0), net=float(income or 0) - float(expense or 0),
        expense_by_category=by_cat, accounts=acc_out,
    )
