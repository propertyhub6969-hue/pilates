from fastapi import APIRouter
from app.api.v1.endpoints import auth

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Modul berikutnya (fase 2+) di-mount di sini:
# api_router.include_router(members.router,  prefix="/members",  tags=["Members"])
# api_router.include_router(packages.router, prefix="/packages", tags=["Packages"])
# api_router.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
# api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
