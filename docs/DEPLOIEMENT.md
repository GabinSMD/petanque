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

### ⚠ Derrière Cloudflare : le joker TLS ne descend que d'un cran

Si le domaine principal est déjà un sous-domaine (`petanque.exemple.fr` dans une
zone `exemple.fr`), alors le nom de l'application en compte **deux**
(`app.petanque.exemple.fr`) — et le certificat Universal SSL gratuit de
Cloudflare ne le couvre pas. Il ne porte que :

```
DNS:exemple.fr, DNS:*.exemple.fr
```

`*.exemple.fr` s'arrête au premier cran. La poignée de main TLS sur
`app.petanque.exemple.fr` échoue alors avant même d'atteindre Caddy — un
symptôme trompeur, puisque le domaine principal fonctionne. Pour le vérifier :

```bash
echo | openssl s_client -connect <ip-cloudflare>:443 \
  -servername app.petanque.exemple.fr 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName
```

Trois issues, et attendre n'en est pas une :

| Choix | Ce qu'il coûte |
| ----- | -------------- |
| Un nom à **un seul cran** (`concours.exemple.fr`) | Le nom est moins parlant. Gratuit, proxy conservé. |
| **Advanced Certificate Manager** (Cloudflare, payant) | Un abonnement mensuel. Couvre `*.petanque.exemple.fr`, nom et proxy conservés. |
| **Proxy désactivé** sur ce sous-domaine (nuage gris) | Caddy prend un certificat Let's Encrypt, qui gère les deux crans. Mais l'IP d'origine devient publique pour ce nom, et le trafic de l'application ne passe plus par le filtrage de Cloudflare : la limitation de débit du serveur devient la seule barrière devant `/api/auth`. |

Avec le proxy désactivé, préférez **deux blocs Caddy séparés** : les deux noms
n'ont plus le même cycle de vie TLS — l'un dépend de Cloudflare, l'autre de
Let's Encrypt — et un échec sur l'un ne trouble pas l'autre.

```
petanque.exemple.fr {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8787
}

app.petanque.exemple.fr {
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

Deux avertissements couvrent les deux populations, parce qu'un seul n'en
atteindrait qu'une :

- **La page vitrine** prévient le visiteur **sans session** dont l'appareil
  garde des données de l'ancienne installation.
- **L'application elle-même** prévient l'utilisateur **connecté** qui continue
  de l'ouvrir sur l'ancienne origine. C'est le cas le plus tenace : son service
  worker sert l'application depuis son cache et l'API répond sous les deux noms,
  donc rien ne l'alerte — il pourrait rester là des mois. Il voit un bandeau
  permanent, plus une fenêtre d'explication à la première rencontre, adaptée
  selon qu'il a un compte (ses concours synchronisés l'attendent) ou qu'il est
  en mode invité (il doit exporter ses concours avant de partir).

Le bandeau de l'application **ne se referme pas** : un avertissement qu'on
renvoie définitivement d'un clic ne déménage personne.

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
