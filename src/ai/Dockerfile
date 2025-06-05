FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (including GDAL dependencies)
RUN apt-get update && apt-get install -y \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port that FastAPI runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]