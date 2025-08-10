FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

RUN apt-get update && apt-get install -y \
    tesseract-ocr \      
    tesseract-ocr-eng \
    build-essential \
    curl

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

RUN find /app/backend -type d -exec touch {}/__init__.py \;

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]