# Docker Deployment for Rubiks Solver (Optimized for Render)

# Stage 1: Build Frontend
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend
COPY rubiks-solver/frontend/package*.json ./
RUN npm install
COPY rubiks-solver/frontend/ ./
RUN npm run build

# Stage 2: Build Backend & Serve
FROM python:3.10-slim

# Install OpenCV system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY rubiks-solver/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY rubiks-solver/backend/ .

# Copy built frontend from Stage 1 into the backend's static folder
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose the port (Render uses $PORT)
EXPOSE 8000

# Start the application using Render's PORT environment variable
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
