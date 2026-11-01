# Use official Python 3.14 slim image
FROM python:3.14-slim

# Install system dependencies (libgomp1 required for XGBoost)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements from backend directory (build context is repo root)
COPY backend/requirements.txt /app/requirements.txt

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code and artifacts into the image
COPY backend/app /app/app
COPY artifacts /app/artifacts

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    ARTIFACTS_DIR=/app/artifacts

# Expose backend port
EXPOSE 8000

# Start FastAPI via uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
