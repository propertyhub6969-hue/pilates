import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.employee import PayrollStatus


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    position: Optional[str] = None
    phone: Optional[str] = None
    base_salary: float = Field(default=0, ge=0)
    join_date: Optional[date] = None
    user_id: Optional[uuid.UUID] = None
    note: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    position: Optional[str] = None
    phone: Optional[str] = None
    base_salary: Optional[float] = Field(default=None, ge=0)
    join_date: Optional[date] = None
    is_active: Optional[bool] = None
    user_id: Optional[uuid.UUID] = None
    note: Optional[str] = None


class EmployeeRow(BaseModel):
    id: uuid.UUID
    name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    base_salary: float
    join_date: Optional[date] = None
    is_active: bool
    user_id: Optional[uuid.UUID] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


# ── Payroll ──
class PayrollCreate(BaseModel):
    employee_id: uuid.UUID
    period: str = Field(pattern=r"^\d{4}-\d{2}$")  # YYYY-MM
    amount: float = Field(ge=0)
    note: Optional[str] = None


class PayrollUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, ge=0)
    note: Optional[str] = None


class PayrollPay(BaseModel):
    account_id: uuid.UUID
    paid_date: date


class PayrollGenerate(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class PayrollRow(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: str
    period: str
    amount: float
    status: PayrollStatus
    paid_date: Optional[date] = None
    account_id: Optional[uuid.UUID] = None
    account_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
