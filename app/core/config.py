from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Reformer Your Body"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 jam — member buka dari HP, jarang login
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    POSTGRES_USER: str = "pilates_user"
    POSTGRES_PASSWORD: str = "pilates_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "pilates_db"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # Timezone — studio single-lokasi. Ganti di .env sesuai lokasi.
    TIMEZONE: str = "Asia/Makassar"  # WITA (UTC+8)

    @property
    def TZ_LABEL(self) -> str:
        """Label singkat zona utk teks pesan (WIB/WITA/WIT)."""
        return {
            "Asia/Jakarta": "WIB",
            "Asia/Makassar": "WITA",
            "Asia/Jayapura": "WIT",
        }.get(self.TIMEZONE, "")

    # WhatsApp reminder (gateway gowa / go-whatsapp-web-multidevice)
    WA_ENABLED: bool = False               # False = dry-run (tak kirim sungguhan)
    WA_GATEWAY_URL: str = ""               # mis. http://whatsapp:3000
    WA_BASIC_AUTH: str = ""                # "user:password" utk basic auth gateway
    WA_DEVICE_ID: str = "studio"           # id device gowa (multi-akun) → header X-Device-Id
    REMINDER_HOUR_LOCAL: int = 17          # jam (zona studio) daemon kirim reminder H-1
    REMINDER_HOURS_BEFORE: int = 2         # reminder kedua: X jam sebelum kelas mulai
    STUDIO_WA_SIGNATURE: str = "Reformer Your Body"  # nama pengirim di teks pesan

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
