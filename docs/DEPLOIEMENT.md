# Déployer Pétanque Concours

Le serveur est **mono-conteneur** : l'API Fastify sert aussi le client
construit. Base SQLite sur disque — prévoyez un **volume persistant**.

> ⚠️ HTTPS obligatoire en production : le mode hors-ligne (service worker)
> et l'installation PWA l'exigent. Fly/Render le fournissent d'office ;
> sur VPS, placez un reverse-proxy (Caddy, Traefik, Nginx + certbot).

> 💶 **Hébergement gratuit à vie** : voir [DEPLOIEMENT-ORACLE.md](./DEPLOIEMENT-ORACLE.md)
> (VM Oracle Cloud « Always Free » + Caddy/DuckDNS ou Cloudflare Tunnel,
> script `deploy/setup-oracle.sh` clé en main).

## Variables d'environnement

| Variable     | Rôle                                            |
| ------------ | ----------------------------------------------- |
| `JWT_SECRET` | **À fixer en production** (`openssl rand -hex 32`) — sinon un secret est généré et conservé dans `DATA_DIR`. |
| `DATA_DIR`   | Dossier persistant (SQLite + secret). Ex. `/data`. |
| `PORT`       | Port HTTP (défaut 8787).                        |

## Option A — Fly.io (recommandé, région Paris)

```bash
fly launch --no-deploy        # reprend fly.toml (renommez `app` si pris)
fly volumes create petanque_data --size 1 --region cdg
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```

## Option B — Render

Créez un « Blueprint » depuis le dépôt : `render.yaml` configure le service
Docker, le disque persistant `/data` et génère `JWT_SECRET`.

## Option C — VPS (docker compose)

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up -d --build
# puis reverse-proxy HTTPS vers 127.0.0.1:8787
```

## Sauvegardes

Sauvegarde à chaud cohérente (VACUUM INTO) avec rétention de 30 copies :

```bash
node scripts/backup-db.mjs /data/petanque.sqlite /data/backups
```

En cron quotidien (3 h du matin) :

```
0 3 * * * node /app/scripts/backup-db.mjs /data/petanque.sqlite /data/backups
```

Restauration : arrêtez le service, remplacez `petanque.sqlite` par la
sauvegarde, redémarrez.

## Durcissement inclus

- Limitation de débit en mémoire : 20 tentatives / 10 min / IP sur
  l'authentification, 120 req/min sur les pages publiques.
- `trustProxy` activé (IP réelle derrière le proxy de la plateforme).
- Jetons JWT signés HS256, mots de passe scrypt salés.
- Les liens publics sont révocables à tout moment depuis l'application.

## Mise à jour

Nouvelle version = nouvelle image : `fly deploy` / redéploiement Render /
`docker compose up -d --build`. La base et le secret vivent dans le volume.
