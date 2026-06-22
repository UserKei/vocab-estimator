#!/usr/bin/env bash
set -euo pipefail

SWAP_SIZE="${SWAP_SIZE:-2G}"
CREATE_SWAP="${CREATE_SWAP:-1}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"
DOCKER_REGISTRY_MIRRORS="${DOCKER_REGISTRY_MIRRORS:-}"

log() {
  printf "\n==> %s\n" "$*"
}

warn() {
  printf "WARN: %s\n" "$*" >&2
}

die() {
  printf "ERROR: %s\n" "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

if [[ "$(uname -s)" != "Linux" ]]; then
  die "This script is intended for Ubuntu/Debian Linux servers."
fi

if [[ ! -r /etc/os-release ]]; then
  die "Cannot read /etc/os-release."
fi

# shellcheck disable=SC1091
. /etc/os-release

if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
  die "Unsupported OS: ${PRETTY_NAME:-unknown}. Use Ubuntu for this project deployment."
fi

SUDO=()
if [[ "${EUID}" -ne 0 ]]; then
  need_cmd sudo
  SUDO=(sudo)
fi

apt_install_base_packages() {
  log "Installing base packages"
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    python3
}

enable_docker_service() {
  if command -v systemctl >/dev/null 2>&1; then
    "${SUDO[@]}" systemctl enable --now docker
  else
    warn "systemctl is not available; start the docker service manually if needed."
  fi
}

restart_docker_service() {
  if command -v systemctl >/dev/null 2>&1; then
    "${SUDO[@]}" systemctl restart docker
  else
    warn "systemctl is not available; restart the docker service manually."
  fi
}

install_docker() {
  if [[ "${INSTALL_DOCKER}" != "1" ]]; then
    log "Skipping Docker installation because INSTALL_DOCKER=${INSTALL_DOCKER}"
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and Docker Compose plugin are already installed"
    enable_docker_service
    return
  fi

  apt_install_base_packages

  log "Configuring Docker official apt repository"
  "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings

  docker_gpg="$(mktemp)"
  trap 'rm -f "${docker_gpg:-}"' EXIT
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o "${docker_gpg}"
  "${SUDO[@]}" gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg "${docker_gpg}"
  "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.gpg

  arch="$(dpkg --print-architecture)"
  codename="${VERSION_CODENAME:-}"
  if [[ -z "${codename}" ]]; then
    codename="$(lsb_release -cs)"
  fi

  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n' \
    "${arch}" \
    "${ID}" \
    "${codename}" |
    "${SUDO[@]}" tee /etc/apt/sources.list.d/docker.list >/dev/null

  log "Installing Docker Engine and Compose plugin"
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    containerd.io \
    docker-buildx-plugin \
    docker-ce \
    docker-ce-cli \
    docker-compose-plugin

  enable_docker_service
}

configure_docker_registry_mirrors() {
  if [[ -z "${DOCKER_REGISTRY_MIRRORS}" ]]; then
    log "No Docker registry mirror configured"
    printf 'Set DOCKER_REGISTRY_MIRRORS=https://mirror.example.com before running this script if Docker Hub is unreachable.\n'
    return
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    apt_install_base_packages
  fi

  log "Configuring Docker registry mirrors"
  "${SUDO[@]}" install -m 0755 -d /etc/docker

  daemon_json_tmp="$(mktemp)"
  trap 'rm -f "${docker_gpg:-}" "${daemon_json_tmp:-}"' EXIT

  DOCKER_REGISTRY_MIRRORS="${DOCKER_REGISTRY_MIRRORS}" python3 - /etc/docker/daemon.json "${daemon_json_tmp}" <<'PY'
import json
import os
import sys
from pathlib import Path

target = Path(sys.argv[1])
output = Path(sys.argv[2])
mirrors = [item.strip() for item in os.environ["DOCKER_REGISTRY_MIRRORS"].split(",") if item.strip()]

if not mirrors:
    raise SystemExit("DOCKER_REGISTRY_MIRRORS is empty after parsing")

config = {}
if target.exists() and target.read_text(encoding="utf-8").strip():
    config = json.loads(target.read_text(encoding="utf-8"))

config["registry-mirrors"] = mirrors
output.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

  if [[ -e /etc/docker/daemon.json ]]; then
    "${SUDO[@]}" cp /etc/docker/daemon.json "/etc/docker/daemon.json.bak.$(date +%Y%m%d%H%M%S)"
  fi
  "${SUDO[@]}" install -m 0644 "${daemon_json_tmp}" /etc/docker/daemon.json
  restart_docker_service
}

ensure_swap() {
  if [[ "${CREATE_SWAP}" != "1" ]]; then
    log "Skipping swap setup because CREATE_SWAP=${CREATE_SWAP}"
    return
  fi

  if swapon --show --noheadings | grep -q .; then
    log "Existing swap detected"
    swapon --show
    return
  fi

  if [[ -e /swapfile ]]; then
    die "/swapfile already exists but is not active. Inspect it before rerunning."
  fi

  log "Creating ${SWAP_SIZE} swap file for a 2-core 2G server"
  "${SUDO[@]}" fallocate -l "${SWAP_SIZE}" /swapfile
  "${SUDO[@]}" chmod 600 /swapfile
  "${SUDO[@]}" mkswap /swapfile
  "${SUDO[@]}" swapon /swapfile

  if ! grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab; then
    printf '/swapfile none swap sw 0 0\n' | "${SUDO[@]}" tee -a /etc/fstab >/dev/null
  fi
}

add_user_to_docker_group() {
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    log "Adding ${SUDO_USER} to docker group"
    "${SUDO[@]}" usermod -aG docker "${SUDO_USER}"
    warn "Log out and log back in before running Docker without sudo."
  fi
}

verify_installation() {
  log "Verifying Docker tools"
  "${SUDO[@]}" docker --version
  "${SUDO[@]}" docker compose version

  if command -v free >/dev/null 2>&1; then
    free -h
  fi
}

main() {
  log "Preparing server for vocab-estimator deployment"
  install_docker
  configure_docker_registry_mirrors
  ensure_swap
  add_user_to_docker_group
  verify_installation

  log "Next steps"
  if [[ -z "${DOCKER_REGISTRY_MIRRORS}" ]]; then
    printf 'If Docker Hub is unreachable, rerun with: DOCKER_REGISTRY_MIRRORS=https://mirror.example.com sudo ./prepare-server.sh\n'
  fi
  printf 'Run: COMPOSE_PARALLEL_LIMIT=1 ./deploy.sh\n'
  printf 'If Docker group membership was changed, reconnect to the server first.\n'
}

main "$@"
