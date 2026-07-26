# Héberger Pétanque Concours gratuitement — Oracle Cloud « Always Free »

Ce guide déploie l'application sur une **machine virtuelle gratuite à vie**
d'Oracle Cloud. Contrairement aux offres « gratuites » qui remettent le
disque à zéro, une VM Oracle a un **disque persistant** : la base SQLite,
le secret de session et les clés de notification survivent aux redémarrages.

> **Rappel utile :** en **mode invité**, l'appli fonctionne déjà sans aucun
> serveur, sur un seul appareil. L'hébergement n'est nécessaire que pour le
> **multi-appareils** (comptes, synchro), le **partage public (QR)** et les
> **notifications push**.

Coût : **0 €**. Une carte bancaire est demandée à l'inscription **pour
vérification d'identité uniquement** — les ressources « Always Free » ne
sont jamais facturées.

---

## 1. Créer le compte et la VM

1. Créez un compte sur <https://www.oracle.com/cloud/free/> (choisissez la
   région la plus proche, ex. *Paris* ou *Marseille* — non modifiable
   ensuite).
2. Console Oracle → **Compute → Instances → Create instance**.
3. **Image & shape** :
   - Image : **Canonical Ubuntu 24.04** (ou 22.04).
   - Shape : **Ampere (ARM) `VM.Standard.A1.Flex`** — cochez « Always Free
     eligible » ; 1 OCPU / 6 Go suffisent largement (jusqu'à 4/24 gratuits).
     À défaut, `VM.Standard.E2.1.Micro` (AMD) convient aussi.
4. **Clé SSH** : laissez la console générer une paire et **téléchargez la
   clé privée** (ou collez votre clé publique).
5. **Create** → notez l'**IP publique** de l'instance une fois lancée.

## 2. Ouvrir les ports web (pare-feu cloud)

Par défaut seul le SSH (22) est autorisé. Il faut ouvrir **80** et **443** :

1. Console → votre instance → **Virtual Cloud Network** → **Security Lists**
   → *Default Security List*.
2. **Add Ingress Rules**, deux fois :
   - Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **80**.
   - Source `0.0.0.0/0`, IP Protocol **TCP**, Destination port **443**.

> Le pare-feu **interne** de la VM (iptables) est ouvert automatiquement par
> le script d'installation de l'étape 4.

## 3. Se connecter en SSH

```bash
chmod 600 votre-cle.key
ssh -i votre-cle.key ubuntu@VOTRE_IP_PUBLIQUE
```

## 4. Installer l'application (script automatique)

Le dépôt fournit un script idempotent. Sur la VM :

```bash
sudo REPO_URL="https://github.com/GabinSMD/petanque.git" \
     BRANCH="claude/saas-concours-offline-faq487" \
     DOMAIN="monclub.duckdns.org" \
     EMAIL="contact@exemple.fr" \
     bash -c "$(curl -fsSL https://raw.githubusercontent.com/GabinSMD/petanque/claude/saas-concours-offline-faq487/deploy/setup-oracle.sh)"
```

Le script : installe **Node 22**, clone le dépôt, `npm install && npm run
build`, crée l'utilisateur `petanque`, installe le **service systemd**,
ouvre 80/443 dans iptables, et — si `DOMAIN` est fourni — installe **Caddy**
pour l'**HTTPS automatique**.

> Sans nom de domaine, omettez `DOMAIN`/`EMAIL` : l'appli tourne alors sur
> `127.0.0.1:8787` et vous exposez l'HTTPS via **Cloudflare Tunnel** (§6).

## 5. Obtenir un nom de domaine gratuit (DuckDNS) + HTTPS

L'HTTPS est **obligatoire** pour l'installation PWA et le push. Le plus
simple et gratuit :

1. <https://www.duckdns.org> → connectez-vous, créez un sous-domaine (ex.
   `monclub`) et pointez-le sur l'**IP publique** de la VM (champ *current
   ip*).
2. Utilisez `monclub.duckdns.org` comme `DOMAIN` à l'étape 4.

Caddy récupère alors seul un certificat Let's Encrypt (~30 s). Votre appli
est en ligne sur **https://monclub.duckdns.org**.

## 6. Variante sans domaine : Cloudflare Tunnel

Si vous possédez un domaine géré par Cloudflare (aucun port à ouvrir) :

```bash
# Lancez d'abord le script SANS DOMAIN (app sur 127.0.0.1:8787), puis :
curl -fsSL https://pkg.cloudflare.com/cloudflared-stable-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create petanque
# Associez un hostname au tunnel vers http://127.0.0.1:8787, puis :
sudo cloudflared service install
```

Cloudflare fournit l'HTTPS de bout en bout via son réseau.

## 7. Vérifications

```bash
curl -s https://monclub.duckdns.org/api/health   # {"ok":true,...}
```

- Ouvrez l'URL sur téléphone → la **bannière « Installer »** doit apparaître.
- Créez un **compte club**, un concours, testez la synchro sur un 2e appareil.
- Activez les **notifications** depuis le lien public (mode « Je joue »).

## 8. Mettre à jour l'application

```bash
cd /opt/petanque/app
sudo -u petanque git pull
sudo -u petanque npm install && sudo -u petanque npm run build
sudo systemctl restart petanque
```

## 9. Sauvegarde de la base

La base et les secrets sont dans `/opt/petanque/data`. Sauvegarde à chaud
fournie par le dépôt :

```bash
node /opt/petanque/app/scripts/backup-db.mjs /opt/petanque/data/petanque.sqlite ~/backups
```

Planifiez-la avec `cron` (ex. tous les soirs) pour ne rien perdre.

## 10. Dépannage

| Symptôme | Piste |
|---|---|
| Page inaccessible | Ports 80/443 ouverts **dans la Security List** ET iptables (`sudo iptables -L INPUT -n`). |
| Certificat HTTPS absent | Le domaine pointe-t-il bien vers l'IP ? `sudo journalctl -u caddy -n 50`. |
| L'API ne démarre pas | `sudo journalctl -u petanque -n 50` ; vérifiez `node -v` ≥ 22.5. |
| Sessions perdues au reboot | Normal si `DATA_DIR` n'est pas persistant — ici il l'est (`/opt/petanque/data`). |

---

Une fois en ligne, l'URL `https://…` sert à la fois d'**application
installable** (PWA) et de **lien public / QR** pour les joueurs.
