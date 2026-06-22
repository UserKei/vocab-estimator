#!/usr/bin/env bash
set -euo pipefail

docker compose build
docker compose up -d postgres
docker compose run --rm api alembic upgrade head
docker compose up -d api web
docker compose ps
