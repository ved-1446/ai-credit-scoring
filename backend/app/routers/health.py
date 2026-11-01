"""
health.py — GET /health endpoint (public, no auth).
Returns model status and version.
"""

from fastapi import APIRouter

from app.ml.loader import store
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Returns 200 if model is loaded, 503 if degraded."""
    if store.loaded:
        return HealthResponse(
            status="ok",
            model_loaded=True,
            model_version=store.model_version,
        )
    else:
        # Return 503 with degraded status
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "model_loaded": False,
            },
        )
