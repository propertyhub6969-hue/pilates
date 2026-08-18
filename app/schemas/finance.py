import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.finance import AccountType


# ── Akun kas/bank ──
class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: AccountType
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    opening_balance: float = Field(default=0, ge=0)


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    opening_balance: Optional[float] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: AccountType
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    opening_balance: float
    is_active: bool
    balance: float = 0  # dihitung

    class Config:
        from_attributes = True


# ── Kategori pengeluaran (dinamis) ──
class ExpenseCategoryRow(BaseModel):
    id: uuid.UUID
    key: str
    label: str
    is_active: bool
    is_builtin: bool
    sort_order: int

    class Config:
        from_attributes = True


class ExpenseCategoryCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)


class ExpenseCategoryUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=120)
    is_active: Optional[bool] = None


# ── Pengeluaran ──
class ExpenseCreate(BaseModel):
    expense_date: date
    category: str
    amount: float = Field(gt=0)
    account_id: uuid.UUID
    description: Optional[str] = None


class ExpenseUpdate(BaseModel):
    expense_date: Optional[date] = None
    category: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    account_id: Optional[uuid.UUID] = None
    description: Optional[str] = None


class ExpenseRow(BaseModel):
    id: uuid.UUID
    expense_date: date
    category: str
    amount: float
    account_id: Optional[uuid.UUID] = None
    account_name: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    edit_count: int = 0

    class Config:
        from_attributes = True


class ExpenseEditRow(BaseModel):
    id: uuid.UUID
    edited_by_name: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Buku besar (mutasi akun) ──
class LedgerEntry(BaseModel):
    date: date
    kind: str            # 'in' (masuk) | 'out' (keluar)
    description: str
    amount: float
    balance: float       # saldo berjalan setelah transaksi ini


class LedgerResponse(BaseModel):
    account_id: uuid.UUID
    account_name: str
    account_type: AccountType
    opening_balance: float       # saldo awal akun
    starting_balance: float      # saldo sebelum periode (opening + mutasi sebelum 'from')
    total_in: float
    total_out: float
    ending_balance: float
    entries: List[LedgerEntry]


# ── Laporan ──
class CategoryAmount(BaseModel):
    category: str
    label: Optional[str] = None
    amount: float


# ── Transfer antar akun ──
class TransferCreate(BaseModel):
    transfer_date: date
    from_account_id: uuid.UUID
    to_account_id: uuid.UUID
    amount: float = Field(gt=0)
    description: Optional[str] = None


class TransferRow(BaseModel):
    id: uuid.UUID
    transfer_date: date
    from_account_id: Optional[uuid.UUID] = None
    to_account_id: Optional[uuid.UUID] = None
    from_account_name: Optional[str] = None
    to_account_name: Optional[str] = None
    amount: float
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FinanceReport(BaseModel):
    date_from: date
    date_to: date
    income: float
    expense: float
    net: float
    expense_by_category: List[CategoryAmount]
    accounts: List[AccountResponse]
    transfers: List[TransferRow] = []
