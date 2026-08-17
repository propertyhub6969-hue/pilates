import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.finance import AccountType, ExpenseCategory


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


# ── Pengeluaran ──
class ExpenseCreate(BaseModel):
    expense_date: date
    category: ExpenseCategory
    amount: float = Field(gt=0)
    account_id: uuid.UUID
    description: Optional[str] = None


class ExpenseUpdate(BaseModel):
    expense_date: Optional[date] = None
    category: Optional[ExpenseCategory] = None
    amount: Optional[float] = Field(default=None, gt=0)
    account_id: Optional[uuid.UUID] = None
    description: Optional[str] = None


class ExpenseRow(BaseModel):
    id: uuid.UUID
    expense_date: date
    category: ExpenseCategory
    amount: float
    account_id: Optional[uuid.UUID] = None
    account_name: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Laporan ──
class CategoryAmount(BaseModel):
    category: ExpenseCategory
    amount: float


class FinanceReport(BaseModel):
    date_from: date
    date_to: date
    income: float
    expense: float
    net: float
    expense_by_category: List[CategoryAmount]
    accounts: List[AccountResponse]
