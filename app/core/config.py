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

    # Timezone — studio single-lokasi. WIB default; ganti di .env kalau beda.
    TIMEZONE: str = "Asia/Jakarta"

    # WhatsApp reminder (gateway gowa / go-whatsapp-web-multidevice)
    WA_ENABLED: bool = False               # False = dry-run (tak kirim sungguhan)
    WA_GATEWAY_URL: str = ""               # mis. http://host.docker.internal:8056
    WA_BASIC_AUTH: str = ""                # "user:password" utk basic auth gateway
    REMINDER_HOUR_LOCAL: int = 17          # jam (zona studio) daemon kirim reminder H-1
    STUDIO_WA_SIGNATURE: str = "Reformer Your Body"  # nama pengirim di teks pesan

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
