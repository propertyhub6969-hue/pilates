"""Import semua model agar terdaftar di Base.metadata (Alembic) & mapper relationship."""
from app.models.base import BaseModel  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
from app.models.studio import StudioSettings  # noqa: F401
from app.models.package import (  # noqa: F401
    Package, MemberPackage, MemberPackageStatus,
)
from app.models.payment import Payment, PaymentMethod, PaymentStatus  # noqa: F401
from app.models.schedule import (  # noqa: F401
    ClassTemplate, ClassSession, ClassSessionStatus,
)
from app.models.booking import Booking, BookingStatus  # noqa: F401
