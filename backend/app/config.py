"""
config.py — Settings loaded from environment variables.
Uses pydantic-settings so you can override via .env or shell vars.
"""

import os


class Settings:
    """Simple settings class that reads from environment variables."""

    def __init__(self):
        # Secret key for JWT signing — MUST be set in production
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")

        # Database URL — SQLite for local dev, PostgreSQL in Docker
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

        # CORS origins — comma-separated list of allowed frontend URLs
        self.CORS_ORIGINS: str = os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
        )

        # Path to the artifacts folder (model files)
        self.ARTIFACTS_DIR: str = os.getenv("ARTIFACTS_DIR", "../artifacts")

        # Admin account seeded at startup
        self.ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@datadynamo.com")
        self.ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin1234")

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse the comma-separated CORS_ORIGINS into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


# Single global instance — import this everywhere
settings = Settings()
