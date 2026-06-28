import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "docker-compose.yml"
INFRA_COMPOSE_FILE = ROOT / "docker-compose.infra.yml"
ENV_EXAMPLE = ROOT / ".env.example"
PACKAGE_JSON = ROOT / "package.json"
WEB_PACKAGE_JSON = ROOT / "apps" / "web" / "package.json"
WEB_VITE_CONFIG = ROOT / "apps" / "web" / "vite.config.ts"


def test_web_service_uses_default_http_port():
    compose = COMPOSE_FILE.read_text(encoding="utf-8")

    assert '"80:80"' in compose
    assert '"8080:80"' not in compose


def test_infra_compose_only_starts_postgres_for_local_development():
    compose = INFRA_COMPOSE_FILE.read_text(encoding="utf-8")

    assert "postgres:" in compose
    assert "postgres:16-alpine" in compose
    assert '"5432:5432"' in compose
    assert "\n  api:" not in compose
    assert "\n  web:" not in compose


def test_root_package_scripts_start_infra_api_and_web():
    scripts = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))["scripts"]

    package_json = PACKAGE_JSON.read_text(encoding="utf-8")
    assert "VOCAB_DATABASE_URL=postgresql+psycopg://" not in package_json
    assert "packages/config" not in package_json
    assert scripts["infra:up"] == "docker compose -f docker-compose.infra.yml up -d"
    assert scripts["infra:down"] == "docker compose -f docker-compose.infra.yml down"
    assert scripts["infra:logs"] == "docker compose -f docker-compose.infra.yml logs -f postgres"
    assert scripts["api:dev"] == ".venv/bin/python -m vocab_api"
    assert scripts["dev:api"] == "pnpm api:dev"
    assert scripts["dev:web"] == "pnpm web:dev"
    assert "pnpm infra:up" in scripts["dev"]
    assert "pnpm api:dev" in scripts["dev"]
    assert "pnpm web:dev" in scripts["dev"]


def test_env_example_keeps_local_configuration_minimal():
    env_example = ENV_EXAMPLE.read_text(encoding="utf-8")

    for expected in [
        "VOCAB_DATABASE_URL=postgresql+psycopg://vocab:vocab@127.0.0.1:5432/vocab_estimator",
        "VOCAB_WORD_RANK_PATH=data/wordlists/word_rank.csv",
        "VOCAB_API_PORT=8000",
        "VOCAB_WEB_PORT=5010",
    ]:
        assert expected in env_example
    for unnecessary in [
        "VOCAB_API_HOST",
        "VOCAB_WEB_HOST",
        "VOCAB_POSTGRES_HOST",
        "VOCAB_POSTGRES_DB",
        "VOCAB_POSTGRES_USER",
        "VOCAB_POSTGRES_PASSWORD",
    ]:
        assert unnecessary not in env_example


def test_web_dev_server_reads_port_and_proxy_from_env_file():
    web_package = json.loads(WEB_PACKAGE_JSON.read_text(encoding="utf-8"))
    vite_config = WEB_VITE_CONFIG.read_text(encoding="utf-8")

    assert "@vocab-estimator/config" not in web_package["dependencies"]
    assert web_package["scripts"]["dev"] == "vite --host 0.0.0.0"
    assert "loadEnv" in vite_config
    assert "VOCAB_WEB_PORT" in vite_config
    assert "VOCAB_API_PORT" in vite_config
