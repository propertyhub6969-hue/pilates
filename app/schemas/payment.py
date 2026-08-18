import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.payment import PaymentMethod, PaymentStatus


class PaymentRow(BaseModel):
    id: uuid.UUID
    receipt_no: Optional[int] = None
    member_id: uuid.UUID
    member_name: Optional[str] = None
    member_package_id: Optional[uuid.UUID] = None
    package_name: Optional[str] = None
    amount: float
    method: PaymentMethod
    status: PaymentStatus
    paid_at: Optional[datetime] = None
    note: Optional[str] = None
    has_proof: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentStatusUpdate(BaseModel):
    status: PaymentStatus
