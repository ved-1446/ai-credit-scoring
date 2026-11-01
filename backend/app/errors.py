"""
errors.py — Custom error classes and FastAPI exception handlers.
Every non-2xx response has the exact shape from API_CONTRACT §11.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger("datadynamo")


class AppError(Exception):
    """Base class for application errors with a status code and error code."""

    def __init__(self, status_code: int, code: str, message: str, details=None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details  # list of {"field": ..., "issue": ...}


# ─── Pre-built error factories ───

def unauthenticated(message: str = "Missing or invalid token") -> AppError:
    return AppError(401, "UNAUTHENTICATED", message)


def invalid_credentials() -> AppError:
    return AppError(401, "INVALID_CREDENTIALS", "Wrong email or password")


def forbidden() -> AppError:
    return AppError(403, "FORBIDDEN", "Admin access required")


def consent_required() -> AppError:
    return AppError(403, "CONSENT_REQUIRED", "Valid consent is required before making a prediction")


def not_found(message: str = "Resource not found") -> AppError:
    return AppError(404, "NOT_FOUND", message)


def email_taken() -> AppError:
    return AppError(409, "EMAIL_TAKEN", "An account with this email already exists")


def validation_error(details: list) -> AppError:
    return AppError(422, "VALIDATION_ERROR", "Request validation failed", details)


def model_not_loaded() -> AppError:
    return AppError(503, "MODEL_NOT_LOADED", "Model artifacts failed to load")


def prediction_error() -> AppError:
    return AppError(500, "PREDICTION_ERROR", "An unexpected error occurred during prediction")


def _build_error_body(code: str, message: str, details=None) -> dict:
    """Build the standard error JSON shape."""
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return body


def register_error_handlers(app: FastAPI):
    """Override FastAPI's default handlers so every error has our shape."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_build_error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        """Turn Pydantic / FastAPI validation errors into our §11 shape.
        Strip the leading 'body' segment from field paths."""
        details = []
        for err in exc.errors():
            # Build dotted path, removing the leading "body" segment
            loc_parts = [str(p) for p in err.get("loc", [])]
            if loc_parts and loc_parts[0] == "body":
                loc_parts = loc_parts[1:]
            field = ".".join(loc_parts) if loc_parts else None
            details.append({"field": field, "issue": err.get("msg", str(err))})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_build_error_body("VALIDATION_ERROR", "Request validation failed", details),
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        """Catch-all: log the real error, return a generic message."""
        logger.exception("Unexpected error: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_build_error_body("PREDICTION_ERROR", "An unexpected error occurred"),
        )

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=404,
            content=_build_error_body("NOT_FOUND", "Resource not found"),
        )
