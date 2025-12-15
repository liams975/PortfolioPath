FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Railway provides PORT env variable
ENV PORT=8000

# Run the application - Railway will set $PORT
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
