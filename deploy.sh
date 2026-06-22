#!/usr/bin/env bash
set -euo pipefail

docker compose build
docker compose up -d postgres
docker compose up -d api web
docker compose exec -T api alembic upgrade head
docker compose ps

