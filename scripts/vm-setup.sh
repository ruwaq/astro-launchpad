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

echo "== 2/4 acceso SSH desde Termux =="
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
keyfile="/mnt/shared/Download/astro-launchpad/scripts/vm-keys/termux.pub"
if [ -f "$keyfile" ]; then
  cat "$keyfile" >> "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
  echo "clave de Termux añadida"
else
  echo "AVISO: no encontré $keyfile"
fi
sudo systemctl enable --now ssh

echo "== 2b/4 opencode =="
if ! command -v opencode >/dev/null 2>&1; then
  curl -fsSL https://opencode.ai/install | bash
else
  echo "opencode ya instalado: $(opencode --version 2>/dev/null || echo ok)"
fi

echo "== 3/4 proyecto desde storage compartido =="
mkdir -p "$HOME/projects"
shared="/mnt/shared/Download/astro-launchpad"
if [ -d "$shared" ]; then
  echo "sincronizando espejo a ~/projects/astro-launchpad..."
  rsync -a --exclude target --exclude node_modules --exclude dist "$shared/" "$HOME/projects/astro-launchpad/"
else
  echo "AVISO: no se encontró $shared"
  echo "Copia el repo a Download en Termux: cp -a ~/projects/astro-launchpad ~/storage/shared/Download/"
fi

echo "== 4/4 estado =="
git -C "$HOME/projects/astro-launchpad" status --short || true
echo "IP del VM: $(hostname -I | awk '{print $1}')"
echo "usuario: $(whoami)"
echo "opencode: $(command -v opencode || echo FALTA)"
echo "listo. para entrar: cd ~/projects/astro-launchpad && opencode"
