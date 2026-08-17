from fastapi import APIRouter
from app.api.v1.endpoints import auth, packages, members, payments, public, schedule, bookings, reports, studio, branches, finance

api_router = APIRouter()

api_router.include_router(public.router, prefix="/public", tags=["Public"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(packages.router, prefix="/packages", tags=["Packages"])
api_router.include_router(members.router, prefix="/members", tags=["Members"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(studio.router, prefix="/studio", tags=["Studio"])
api_router.include_router(branches.router, prefix="/branches", tags=["Branches"])
api_router.include_router(finance.router, prefix="/finance", tags=["Finance"])
