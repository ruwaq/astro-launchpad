#!/usr/bin/env bash
# Bootstrap Debian (AVF Terminal VM) para astro-launchpad
# Uso: dentro de la VM Debian: bash /mnt/shared/Download/astro-launchpad/scripts/vm-setup.sh
set -euo pipefail

echo "== 1/4 apt update + paquetes base =="
sudo apt update
sudo apt -y full-upgrade
sudo apt -y install \
  git curl unzip rsync jq ca-certificates \
  build-essential pkg-config libssl-dev \
  openssh-server
sudo systemctl enable --now ssh

echo "== 2/4 opencode =="
if ! command -v opencode >/dev/null 2>&1; then
  curl -fsSL https://opencode.ai/install | bash
else
  echo "opencode ya instalado: $(opencode --version 2>/dev/null || echo ok)"
fi

echo "== 3/4 proyecto desde storage compartido =="
mkdir -p "$HOME/projects"
shared="/mnt/shared/Download/astro-launchpad"
if [ -d "$shared" ]; then
  if [ -d "$HOME/projects/astro-launchpad/.git" ]; then
    echo "proyecto ya existe en VM, sincronizando..."
    rsync -a --exclude target --exclude node_modules "$shared/" "$HOME/projects/astro-launchpad/"
  else
    echo "clonando espejo desde /mnt/shared..."
    rsync -a --exclude target --exclude node_modules "$shared/" "$HOME/projects/astro-launchpad/"
  fi
else
  echo "AVISO: no se encontró $shared"
  echo "Copia el repo a Download en Termux: cp -a ~/projects/astro-launchpad ~/storage/shared/Download/"
fi

echo "== 4/4 estado =="
git -C "$HOME/projects/astro-launchpad" status --short || true
echo "listo. para entrar: cd ~/projects/astro-launchpad && opencode"
