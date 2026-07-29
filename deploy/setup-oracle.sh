#!/usr/bin/env bash
#
# Installe Pétanque Concours sur une VM Ubuntu (pensé pour Oracle Cloud
# « Always Free »). Idempotent : relançable sans risque.
#
# Usage (en root, sur la VM) :
#   sudo REPO_URL="https://github.com/GabinSMD/petanque.git" \
#        BRANCH="claude/saas-concours-offline-faq487" \
#        DOMAIN="monclub.duckdns.org" \
#        EMAIL="contact@exemple.fr" \
#        bash setup-oracle.sh
#
# - DOMAIN vide  → installe seulement l'app + le service (HTTPS à faire via
#                  Cloudflare Tunnel, voir docs/DEPLOIEMENT-ORACLE.md).
# - DOMAIN fourni → installe aussi Caddy (HTTPS automatique Let's Encrypt).
# - APP_DOMAIN fourni en plus → DOMAIN sert la page vitrine, APP_DOMAIN sert
#                  l'application. Les deux noms doivent pointer vers cette VM.

set -euo pipefail

REPO_URL="${REPO_URL:?Définissez REPO_URL=https://github.com/USER/petanque.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"
APP_DOMAIN="${APP_DOMAIN:-}"
EMAIL="${EMAIL:-}"

if [[ -n "$APP_DOMAIN" && -z "$DOMAIN" ]]; then
  echo "APP_DOMAIN sans DOMAIN : indiquez aussi le domaine de la vitrine." >&2
  exit 1
fi
APP_DIR="/opt/petanque/app"
DATA_DIR="/opt/petanque/data"
APP_USER="petanque"

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

if [[ $EUID -ne 0 ]]; then echo "À lancer en root (sudo)." >&2; exit 1; fi

log "Paquets de base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates git

log "Node.js 22 (requis : ≥ 22.5 pour node:sqlite)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22.* && "$(node -v)" != v2[3-9].* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

log "Utilisateur applicatif « $APP_USER »"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR"

log "Récupération du code ($BRANCH)"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# Les adresses des deux noms de domaine sont figées dans le paquet du client :
# ce fichier doit exister AVANT le build. Il n'est pas suivi par git, donc il
# survit aux mises à jour (`git reset --hard` ne touche pas aux fichiers non
# suivis) — voir deploy/update.sh.
if [[ -n "$APP_DOMAIN" ]]; then
  log "Adresses du client (client/.env.production)"
  cat > "$APP_DIR/client/.env.production" <<EOF
VITE_APP_ORIGIN=https://$APP_DOMAIN
VITE_SITE_ORIGIN=https://$DOMAIN
EOF
fi

log "Installation des dépendances + build"
( cd "$APP_DIR" && npm install && npm run build )

chown -R "$APP_USER:$APP_USER" /opt/petanque

log "Service systemd"
install -m 644 "$APP_DIR/deploy/petanque.service" /etc/systemd/system/petanque.service
if [[ -n "$EMAIL" ]]; then
  sed -i "s#mailto:contact@exemple.fr#mailto:$EMAIL#" /etc/systemd/system/petanque.service
fi
if [[ -n "$APP_DOMAIN" ]]; then
  # Décommente les deux lignes du service et y met les vrais noms. Le
  # délimiteur ne peut pas être « # », qui apparaît dans le motif.
  sed -i "s|^# *Environment=VITRINE_HOST=.*|Environment=VITRINE_HOST=$DOMAIN|" /etc/systemd/system/petanque.service
  sed -i "s|^# *Environment=APP_ORIGIN=.*|Environment=APP_ORIGIN=https://$APP_DOMAIN|" /etc/systemd/system/petanque.service
fi
systemctl daemon-reload
systemctl enable --now petanque
sleep 2
systemctl --no-pager --full status petanque | head -n 6 || true

log "Ouverture des ports 80/443 (pare-feu interne de la VM)"
# Les images Oracle Ubuntu bloquent tout sauf SSH par défaut : on autorise
# explicitement le web, puis on persiste les règles.
if command -v iptables >/dev/null; then
  iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
  iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
  apt-get install -y netfilter-persistent iptables-persistent >/dev/null 2>&1 || true
  netfilter-persistent save >/dev/null 2>&1 || true
fi
echo "⚠  N'oubliez pas d'ouvrir AUSSI 80/443 dans la Security List de votre VCN Oracle (console web)."

if [[ -n "$DOMAIN" ]]; then
  log "Caddy (HTTPS automatique) pour ${APP_DOMAIN:+$DOMAIN et }${APP_DOMAIN:-$DOMAIN}"
  if ! command -v caddy >/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y && apt-get install -y caddy
  fi
  HOSTS="$DOMAIN"
  [[ -n "$APP_DOMAIN" ]] && HOSTS="$DOMAIN, $APP_DOMAIN"
  printf '%s {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:8787\n}\n' "$HOSTS" > /etc/caddy/Caddyfile
  systemctl reload caddy || systemctl restart caddy
  if [[ -n "$APP_DOMAIN" ]]; then
    echo "✓ Vitrine sur https://$DOMAIN — application sur https://$APP_DOMAIN (certificats : ~30 s)."
  else
    echo "✓ Application disponible sur https://$DOMAIN (le certificat peut prendre ~30 s)."
  fi
else
  echo "✓ Application en écoute sur 127.0.0.1:8787. Configurez l'HTTPS (Caddy ou Cloudflare Tunnel)."
fi

log "Terminé."
