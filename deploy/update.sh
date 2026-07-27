#!/usr/bin/env bash
#
# Met à jour Pétanque Concours sur la VM : récupère la dernière version de la
# branche, réinstalle, rebuild et redémarre le service. Idempotent.
#
# Usage (sur la VM) :  sudo bash /opt/petanque/app/deploy/update.sh [branche]
# Appelé aussi par le déploiement continu (voir .github/workflows/deploy.yml).

set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/opt/petanque/app"
APP_USER="petanque"

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

if [[ $EUID -ne 0 ]]; then echo "À lancer en root (sudo)." >&2; exit 1; fi
if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Dépôt absent dans $APP_DIR — lancez d'abord deploy/setup-oracle.sh." >&2
  exit 1
fi

log "Récupération de la dernière version ($BRANCH)"
sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"

log "Dépendances + build"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm install && npm run build"

log "Redémarrage du service"
systemctl restart petanque
sleep 2
systemctl --no-pager --full status petanque | head -n 5 || true

log "Mise à jour terminée."
