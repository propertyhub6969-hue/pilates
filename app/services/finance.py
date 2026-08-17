"""Utilitas keuangan: rute akun penerima income + hitung saldo akun."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinancialAccount, AccountType, Expense
from app.models.payment import Payment, PaymentMethod, PaymentStatus


async def resolve_income_account(db: AsyncSession, method: PaymentMethod):
    """Tentukan akun penerima berdasar metode: cash→akun kas, lainnya→akun bank.
    Fallback ke akun aktif pertama. Return account_id atau None."""
    prefer = AccountType.CASH if method == PaymentMethod.CASH else AccountType.BANK
    acc = (
        await db.execute(
            select(FinancialAccount.id).where(
                FinancialAccount.is_active.is_(True), FinancialAccount.type == prefer
            ).order_by(FinancialAccount.created_at.asc()).limit(1)
        )
    ).scalar_one_or_none()
    if acc is None:
        acc = (
            await db.execute(
                select(FinancialAccount.id).where(FinancialAccount.is_active.is_(True))
                .order_by(FinancialAccount.created_at.asc()).limit(1)
            )
        ).scalar_one_or_none()
    return acc


async def account_balance(db: AsyncSession, account: FinancialAccount) -> float:
    """Saldo = saldo awal + income lunas (account_id ini) − pengeluaran (account_id ini)."""
    income = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.account_id == account.id, Payment.status == PaymentStatus.PAID
            )
        )
    ).scalar_one()
    expense = (
        await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.account_id == account.id)
        )
    ).scalar_one()
    return float(account.opening_balance or 0) + float(income or 0) - float(expense or 0)
