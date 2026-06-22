from pathlib import Path
import stat
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "prepare-server.sh"


def test_prepare_server_script_exists_and_is_executable():
    assert SCRIPT.exists()
    assert SCRIPT.read_text(encoding="utf-8").startswith("#!/usr/bin/env bash")
    assert SCRIPT.stat().st_mode & stat.S_IXUSR


def test_prepare_server_script_has_valid_bash_syntax():
    subprocess.run(["bash", "-n", str(SCRIPT)], check=True)


def test_prepare_server_script_installs_docker_and_compose_plugin():
    script = SCRIPT.read_text(encoding="utf-8")

    for expected in [
        "download.docker.com/linux/${ID}",
        "/etc/apt/keyrings/docker.gpg",
        "docker-ce",
        "docker-ce-cli",
        "containerd.io",
        "docker-buildx-plugin",
        "docker-compose-plugin",
        "systemctl enable --now docker",
    ]:
        assert expected in script


def test_prepare_server_script_handles_low_memory_server_swap():
    script = SCRIPT.read_text(encoding="utf-8")

    for expected in ["SWAP_SIZE", "/swapfile", "fallocate", "mkswap", "swapon"]:
        assert expected in script


def test_prepare_server_script_can_configure_registry_mirrors():
    script = SCRIPT.read_text(encoding="utf-8")

    for expected in [
        "DOCKER_REGISTRY_MIRRORS",
        "/etc/docker/daemon.json",
        "registry-mirrors",
        "systemctl restart docker",
    ]:
        assert expected in script
