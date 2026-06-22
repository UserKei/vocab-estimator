FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml alembic.ini ./
COPY apps/api ./apps/api
COPY packages ./packages
COPY data/wordlists ./data/wordlists
COPY data/samples ./data/samples
COPY reports/outputs ./reports/outputs

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["python", "-m", "vocab_api"]
