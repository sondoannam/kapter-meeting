FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgomp1 libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-cloud.txt ./requirements-cloud.txt

RUN pip install --upgrade pip \
    && pip install -r requirements-cloud.txt

COPY server.py ./server.py
COPY kapter_ai_worker ./kapter_ai_worker

EXPOSE 8080

CMD ["python", "server.py"]