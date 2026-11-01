"""
main.py — FastAPI app setup.
- CORS middleware
- Custom error handlers (§11)
- Lifespan: load model artifacts, create DB tables, seed admin
- Include all routers
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import engine, Base, SessionLocal
from app.models import User
from app.security import hash_password
from app.errors import register_error_handlers
from app.ml.loader import load_artifacts

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("datadynamo")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load model artifacts, create tables, seed admin user."""
    # 1. Create database tables if they don't exist
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created.")

    # 2. Load model artifacts (if this fails, app still starts in degraded mode)
    load_artifacts(settings.ARTIFACTS_DIR)

    # 3. Seed admin user if it doesn't exist
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL.lower()).first()
        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL.lower(),
                full_name="Admin",
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info("Admin user seeded: %s", settings.ADMIN_EMAIL)
        else:
            logger.info("Admin user already exists: %s", settings.ADMIN_EMAIL)
    finally:
        db.close()

    yield  # app runs

    # Shutdown — nothing special to clean up
    logger.info("Shutting down.")


# Create the FastAPI app
app = FastAPI(
    title="Data Dynamo — AI Credit Scoring",
    description="Credit risk assessment powered by XGBoost + SMOTE",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — explicit origins only, no wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Override FastAPI's default error handlers with our §11-shaped responses
register_error_handlers(app)

# Include all routers
from app.routers import health, auth, consent, predict, history, metrics, admin, explain, chat

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(consent.router)
app.include_router(predict.router)
app.include_router(history.router)
app.include_router(metrics.router)
app.include_router(admin.router)
app.include_router(explain.router)
app.include_router(chat.router)


