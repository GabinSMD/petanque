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
| `VITRINE_HOST` | Nom de domaine de la page vitrine, si elle est séparée de l'application. Vide = un seul nom de domaine, tout est l'application. |
| `APP_ORIGIN` | Origine de l'application (`https://app.exemple.fr`), vers laquelle la vitrine redirige les chemins applicatifs. |

## Deux noms de domaine : vitrine et application

Par défaut, un seul nom de domaine sert tout : la page de présentation
s'affiche à la racine pour un visiteur sans session, le tableau de bord pour un
utilisateur connecté. Rien à configurer.

Pour séparer les deux — présentation sur `petanque.exemple.fr`, application sur
`app.petanque.exemple.fr` — les deux noms arrivent sur **le même serveur**, qui
choisit le document d'après l'en-tête `Host`.

**1. DNS.** Créez l'enregistrement `app` (A/AAAA vers l'IP de la VM, ou CNAME).
Derrière Cloudflare, laissez le proxy activé comme pour le domaine principal.

**2. Adresses figées dans le client.** Le paquet du client contient les liens de
la vitrine vers l'application : ils sont fixés **au build**. Créez, sur le
serveur, `client/.env.production` — il n'est pas suivi par git, donc il survit
aux mises à jour :

```
VITE_APP_ORIGIN=https://app.petanque.exemple.fr
VITE_SITE_ORIGIN=https://petanque.exemple.fr
```

`VITE_SITE_ORIGIN` ne sert qu'aux aperçus de lien (Open Graph), qui exigent des
adresses absolues.

**3. Service.** Décommentez dans `deploy/petanque.service` :

```
Environment=VITRINE_HOST=petanque.exemple.fr
Environment=APP_ORIGIN=https://app.petanque.exemple.fr
```

**4. Caddy.** Une seule entrée pour les deux noms — le tri se fait dans
l'application :

```
petanque.exemple.fr, app.petanque.exemple.fr {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8787
}
```

Puis `npm run build`, `systemctl restart petanque`, `systemctl reload caddy`.
Une installation neuve fait tout cela d'un coup :

```bash
sudo REPO_URL=… DOMAIN=petanque.exemple.fr APP_DOMAIN=app.petanque.exemple.fr \
     bash deploy/setup-oracle.sh
```

### Ce que fait le nom de domaine de la vitrine

| Chemin | Traitement |
| ------ | ---------- |
| `/` | La page vitrine (document `vitrine.html`, sans service worker ni base locale). |
| `/assets/…`, `/vitrine/…`, `/favicon.svg` | Servis : la vitrine en a besoin. |
| `/api/…` | **Servi normalement.** Les appareils déjà installés depuis l'ancienne adresse continuent de se synchroniser ; une redirection casserait leurs requêtes POST. |
| tout le reste | Redirection 301 vers `APP_ORIGIN`, chemin conservé — les liens publics `/p/:token` distribués aux équipes et les QR codes affichés au boulodrome continuent de fonctionner. |

### ⚠ Si l'application vivait déjà sur le domaine principal

Les données locales d'un navigateur appartiennent à **une origine**. En
déplaçant l'application vers `app.`, les appareils qui l'utilisaient sur
l'ancien nom :

- **retrouvent tout après une simple connexion** sur la nouvelle adresse, pour
  ce qui avait été **synchronisé** ;
- **perdent** ce qui n'avait jamais quitté l'appareil, c'est-à-dire les concours
  créés en **mode invité** — à exporter (« Sauvegarde ») depuis l'ancienne
  adresse avant de la quitter.

La page vitrine détecte ce cas : si elle trouve une session locale laissée par
l'ancienne installation, elle affiche un bandeau qui l'explique et renvoie vers
la nouvelle adresse. Les applications déjà **installées** (écran d'accueil)
pointent sur l'ancien `start_url` : elles ouvriront la vitrine, où ce bandeau
les attend.

La redirection est **permanente (301)** : les navigateurs la gardent en cache.
Un retour en arrière demande de vider ce cache côté visiteur.

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
