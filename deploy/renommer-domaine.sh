#!/usr/bin/env bash
#
# Change le nom de domaine du serveur : remplace l'ancien nom par le nouveau
# partout où la VM le connaît, puis recharge ce qui doit l'être.
#
# Renommer l'enregistrement DNS ne suffit pas. Trois fichiers portent le nom,
# et aucun n'est suivi par git :
#   - /etc/caddy/Caddyfile                    (noms servis, certificats)
#   - /etc/systemd/system/petanque.service    (VITRINE_HOST, APP_ORIGIN)
#   - client/.env.production                  (adresses figées dans le build)
#
# Le remplacement porte sur le nom entier : passer de `petanque.exemple.fr` à
# `treizero.exemple.fr` déplace aussi `app.petanque.exemple.fr`.
#
# Usage (sur la VM) :
#   sudo bash /opt/petanque/app/deploy/renommer-domaine.sh ANCIEN NOUVEAU
#
# Idempotent : relancé une fois le changement fait, il ne trouve plus l'ancien
# nom et ne touche à rien. Chaque fichier modifié garde une copie datée à côté
# de lui. Si Caddy refuse la nouvelle configuration, l'ancienne est remise.
#
# Il ne reconstruit pas le client et ne redémarre pas le service : c'est le
# rôle de la mise à jour qui suit (deploy/update.sh, ou le déploiement continu).

set -euo pipefail

ANCIEN="${1:-}"
NOUVEAU="${2:-}"
APP_DIR="/opt/petanque/app"
# Réservé aux essais : préfixe posé devant chaque chemin, et aucun service
# rechargé. Laisser vide sur la VM.
PREFIXE="${PREFIXE:-}"

if [[ -z "$ANCIEN" || -z "$NOUVEAU" ]]; then
  echo "Usage : sudo bash $0 ancien.domaine nouveau.domaine" >&2
  exit 1
fi
for nom in "$ANCIEN" "$NOUVEAU"; do
  if [[ ! "$nom" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
    echo "« $nom » n'est pas un nom de domaine." >&2
    exit 1
  fi
done
if [[ "$ANCIEN" == "$NOUVEAU" ]]; then
  echo "Ancien et nouveau nom identiques : rien à faire."
  exit 0
fi
if [[ -z "$PREFIXE" && $EUID -ne 0 ]]; then
  echo "À lancer en root (sudo)." >&2
  exit 1
fi

CADDYFILE="$PREFIXE/etc/caddy/Caddyfile"
SERVICE="$PREFIXE/etc/systemd/system/petanque.service"
ENV_CLIENT="$PREFIXE$APP_DIR/client/.env.production"

horodatage="$(date +%Y%m%d-%H%M%S)"
# Les points du nom sont des caractères ordinaires, pas des jokers.
ancien_motif="${ANCIEN//./\\.}"
modifies=()

for fichier in "$CADDYFILE" "$SERVICE" "$ENV_CLIENT"; do
  [[ -f "$fichier" ]] || continue
  grep -qF -- "$ANCIEN" "$fichier" || continue
  cp -p "$fichier" "$fichier.avant-$horodatage"
  sed -i "s/$ancien_motif/$NOUVEAU/g" "$fichier"
  # `sed -i` réécrit le fichier : on lui rend son propriétaire et ses droits.
  chown --reference="$fichier.avant-$horodatage" "$fichier"
  chmod --reference="$fichier.avant-$horodatage" "$fichier"
  modifies+=("$fichier")
  echo "✓ $fichier : $ANCIEN → $NOUVEAU (copie : $fichier.avant-$horodatage)"
done

if [[ ${#modifies[@]} -eq 0 ]]; then
  echo "« $ANCIEN » n'apparaît dans aucun fichier de configuration : rien à faire."
  exit 0
fi

contient() {
  local cherche="$1" f
  for f in "${modifies[@]}"; do [[ "$f" == "$cherche" ]] && return 0; done
  return 1
}

if [[ -n "$PREFIXE" ]]; then
  echo "Essai : aucun service rechargé."
  exit 0
fi

if contient "$CADDYFILE"; then
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "✓ Caddy rechargé : il demande les certificats des nouveaux noms (~30 s)."
  else
    cp -p "$CADDYFILE.avant-$horodatage" "$CADDYFILE"
    echo "Caddy refuse la nouvelle configuration : l'ancienne est remise." >&2
    caddy validate --config "$CADDYFILE.avant-$horodatage" --adapter caddyfile >&2 || true
    exit 1
  fi
fi

if contient "$SERVICE"; then
  systemctl daemon-reload
  echo "✓ Service relu. Il prendra les nouveaux noms à son prochain redémarrage."
fi

if contient "$ENV_CLIENT"; then
  echo "✓ Adresses du client changées : elles entreront dans le prochain build."
fi
