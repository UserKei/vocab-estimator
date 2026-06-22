from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "docker-compose.yml"


def test_web_service_uses_default_http_port():
    compose = COMPOSE_FILE.read_text(encoding="utf-8")

    assert '"80:80"' in compose
    assert '"8080:80"' not in compose
