# Redéploiement E-FormationGN

Comment livrer du code modifié en production.

**Production en place :** https://gandal.org — VPS Hostinger `srv1768778.hstgr.cloud` (213.130.144.215).

---

## Architecture de prod

- **Orchestration :** Docker Compose, projet `eformationgn`, dossier `/docker/e-formationgn/` sur le VPS.
- **Conteneurs :** `db` (PostgreSQL 16) · `app` (Next.js) · `cron` (tâches planifiées, dont conversion des présentations chaque minute). Pas de Caddy.
- **Image :** `bahm2062/e-formationgn` sur Docker Hub. Buildée **sur le Mac** (Apple Silicon) en `linux/amd64`, **jamais sur le VPS** (VPS trop chargé).
- **Reverse proxy / HTTPS :** **nginx** sur l'hôte (ports 80/443), qui relaie
  vers le port applicatif lié uniquement à `127.0.0.1:3300`. Aucun Caddy ni
  Traefik ne participe au routage de cette stack.
- **Secrets :** `/docker/e-formationgn/.env` sur le VPS — **jamais commité**, jamais dans l'image.
- **Migrations :** appliquées automatiquement au démarrage du conteneur `app` (`prisma migrate deploy` dans l'entrypoint). Aucune action manuelle.

---

## Pré-requis (une seule fois)

**Sur le Mac :**
```bash
docker login                 # compte Docker Hub : bahm2062
docker buildx version        # buildx doit répondre (inclus dans Docker Desktop)
```

**Sur le VPS :** le dossier `/docker/e-formationgn/` doit contenir `docker-compose.yml` (copie de [celui du repo](docker-compose.yml)) + `.env`.

Checklist obligatoire dans `/docker/e-formationgn/.env` :

- `CRON_SECRET` aléatoire d'au moins 16 caractères ; le service `cron` ne peut appeler aucune route planifiée sans lui.
- Sans R2, `PRIVATE_UPLOAD_ROOT=/app/private-uploads`. Le volume privé `eformationgn_app_private_uploads` doit rester monté et persistant : il contient les sources PPTX et les diapositives converties.
- Avec R2, `R2_PRIVATE_BUCKET` doit désigner un bucket privé, non publié, et distinct de `R2_BUCKET`.

---

## Redéployer (à chaque modif de code)

### 1. Mac — build + push

```bash
cd ~/e-formationgn
npm run deploy            # = ./scripts/deploy.sh
```

Le script build l'image `linux/amd64` et la pousse sur Docker Hub sous deux tags : `latest` **et** le SHA git court (pour le rollback). Après disponibilité de l'image, il synchronise le `docker-compose.yml` versionné vers un candidat distant, valide ce candidat, sauvegarde puis remplace atomiquement le Compose courant, et recrée `app` **et** `cron`. Durée : ~3-8 min.

Le script refuse de construire si le dépôt contient un changement non commité
ou un fichier non suivi, si `HEAD` est détaché, ou si le commit courant n'est
pas exactement celui publié sur `origin/<branche>`.

`.env.deploy` doit définir explicitement `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_PLATFORM_MODE`, `NEXT_PUBLIC_SENTRY_DSN` et
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. `VPS_SSH` est obligatoire : avant tout push,
un préflight distant strict exige aussi `SENTRY_DSN`, la copie runtime du DSN
public et la paire Turnstile complète (obligatoire en mode centre). Il contrôle
la correspondance exacte des deux valeurs publiques build/runtime, le mode et
la paire Upstash sans jamais afficher les valeurs.

Exception temporaire : `ALLOW_OPTIONAL_MONITORING=1 npm run deploy` autorise
une livraison sans Sentry, Turnstile ni Resend. Les secrets indispensables à
l'exécution (base de données, Auth et cron) et les autres contrôles restent
obligatoires. Cette option doit être retirée dès que les services externes sont
configurés.

### 2. VPS — procédure manuelle sûre

Depuis le Mac, transférer d'abord le Compose versionné sous un nom candidat :

```bash
scp docker-compose.yml root@213.130.144.215:/docker/e-formationgn/docker-compose.yml.candidate
```

Puis, dans le Terminal Hostinger :

```bash
cd /docker/e-formationgn
docker compose -f docker-compose.yml.candidate config --quiet
cp -p docker-compose.yml docker-compose.yml.backup
mv docker-compose.yml.candidate docker-compose.yml
docker compose pull app
docker compose up -d app cron
docker compose ps app cron
curl -fsS http://127.0.0.1:3300/api/health
curl -fsS -o /dev/null http://127.0.0.1:3300/
```

Ne faire le `mv` que si `config --quiet` réussit. `up -d app cron` recrée les deux services nécessaires à la conversion, sans toucher `db` ni ses volumes. Les migrations Prisma s'appliquent au boot. Sans R2, les sources `.pptx` et images converties restent dans le volume privé `eformationgn_app_private_uploads`, monté sur `/app/private-uploads` et jamais sous `public/`.

> **Tout depuis le Mac en une commande :** configure un accès SSH par clé au VPS, puis :
> ```bash
> export VPS_SSH=root@213.130.144.215
> npm run deploy
> ```
>
> La clé par défaut est refusée par l'hôte : utiliser `~/.ssh/claude_deploy`
> (ou `~/.ssh/deploy_key`). Exemple :
> `ssh -i ~/.ssh/claude_deploy root@213.130.144.215`
> Le script synchronise et valide alors le Compose versionné, recrée `app` et
> `cron`, attend le healthcheck applicatif (180 s maximum), exige que `cron`
> soit présent et `running`, puis teste `/api/health` et la page d'accueil.
> En cas d'échec, il affiche l'état et les logs de `app` et `cron`, puis s'arrête.

### 3. Vérifier

```bash
docker compose ps app cron                 # app = Up (healthy), cron = Up
curl -sI https://gandal.org | head -1      # HTTP/2 200
```

---

## Rollback (revenir à une version précédente)

Chaque build est taggé avec le SHA git. Tags disponibles : https://hub.docker.com/r/bahm2062/e-formationgn/tags

> **Ne pas automatiser le rollback applicatif après un démarrage échoué.**
> L'entrypoint peut avoir appliqué des migrations Prisma avant l'échec du
> healthcheck. Confirme d'abord que le schéma reste compatible avec l'ancien
> binaire et restaure la sauvegarde pré-déploiement si la migration ne l'est pas.

Sur le VPS :
```bash
cd /docker/e-formationgn
docker pull bahm2062/e-formationgn:<SHA>
docker tag  bahm2062/e-formationgn:<SHA> bahm2062/e-formationgn:latest
docker compose up -d
```

---

## Si tu modifies `docker-compose.yml`

Le [docker-compose.yml](docker-compose.yml) du repo est la **source de vérité**. `npm run deploy` le synchronise systématiquement par fichier candidat validé avant remplacement. En procédure manuelle, reprendre exactement le transfert, `config --quiet`, backup et `mv` décrits plus haut ; ne jamais écraser directement le Compose actif avec un fichier non validé.

---

## Points de vigilance

- **Ne jamais supprimer** le dossier `/docker/e-formationgn/`, le volume `eformationgn_db_data` ni le volume privé `eformationgn_app_private_uploads` si le fallback local est utilisé.
- Si le service `cron` est absent ou arrêté, les nouvelles présentations restent en attente de conversion ; un site sain ne suffit donc pas à déclarer le déploiement réussi.
- Garde une **copie sûre du `.env`** (gestionnaire de mots de passe) — il a déjà été perdu une fois ; il a fallu le reconstruire depuis le conteneur.
- Mot de passe Postgres : **hex uniquement** (`openssl rand -hex 24`). Un mot de passe base64 (caractères `+` `/`) casse le parseur de connexion `pg` au runtime (`28P01`), alors même que `prisma migrate deploy` l'accepte.
- Sauvegarde DB : utiliser le dépôt restic chiffré hors site et le drill isolé
  décrits dans [DEPLOY.md](DEPLOY.md). Un dump stocké uniquement sur le VPS ne
  constitue pas un plan de reprise.

---

## Construction rapide (recommandé)

La construction locale dure **45 à 60 minutes**, et ce n'est pas une anomalie :
le Mac est en ARM, l'image cible du x86_64, et la VM Docker plafonnée à 3,8 Go
sur une machine de 8 Go impose un seul worker Next (`experimental.cpus`) et
Webpack à la place de Turbopack. Trois contournements pour une même cause.

Un runner GitHub est nativement x86_64 avec 16 Go : **4 à 6 minutes**.

### Mise en place, une seule fois

Dans le dépôt GitHub, *Settings → Secrets and variables → Actions* :

| Type | Nom | Valeur |
|---|---|---|
| Secret | `DOCKERHUB_USERNAME` | votre identifiant Docker Hub |
| Secret | `DOCKERHUB_TOKEN` | un jeton d'accès Docker Hub (pas le mot de passe) |
| Variable | `NEXT_PUBLIC_APP_URL` | `https://gandal.org` |
| Variable | `NEXT_PUBLIC_APP_NAME` | `Aiduca` |
| Variable | `NEXT_PUBLIC_PLATFORM_MODE` | `centre_formation` |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | vide tant que non configuré |
| Variable | `NEXT_PUBLIC_SENTRY_DSN` | vide tant que non configuré |

Les `NEXT_PUBLIC_*` sont des **variables**, pas des secrets : Next les inscrit
en clair dans le JavaScript envoyé au navigateur.

### Usage

1. Pousser le commit, puis lancer le workflow **« Construire et publier
   l'image »** depuis l'onglet *Actions* (ou attendre qu'un push sur `main` le
   déclenche).
2. Une fois l'image publiée :

```bash
export VPS_SSH=root@213.130.144.215
SKIP_BUILD=1 npm run deploy
```

Le script saute la construction, vérifie que le tag existe bien sur Docker Hub,
et enchaîne le redéploiement distant. **Toutes les barrières de qualité restent
exécutées** — typage, lint, tests, préflight des variables.

La construction locale reste disponible en lançant `npm run deploy` sans
`SKIP_BUILD` : elle ne dépend d'aucun service tiers, ce qui en fait le recours
si GitHub Actions est indisponible.


## Dépannage

| Symptôme | Cause | Action |
|---|---|---|
| Build Mac : `docker-credential-desktop not found` | PATH sans Docker.app | Le script exporte déjà le PATH ; sinon : `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` |
| `docker compose pull` : `denied` / `not found` | Pas connecté à Docker Hub | `docker login` sur le Mac |
| `app` en `Restarting` après un deploy | Migration Prisma ou variable d'env | `docker logs --tail 80 eformationgn-app-1` |
| `28P01 password authentication failed` | Mot de passe DB non URL-safe | Cf. note « hex uniquement » ci-dessus |
| `502 Bad Gateway` sur le domaine | `app` pas `(healthy)` → nginx ne peut pas relayer | `docker compose ps` puis logs `app` |
| Le site ne change pas après un deploy | Vieille image encore en cache | Vérifier que `docker compose pull` a bien tiré un nouveau digest |

---

## Premier déploiement / mise en place initiale

Voir [DEPLOY.md](DEPLOY.md) (DNS, secrets, création du premier admin).
