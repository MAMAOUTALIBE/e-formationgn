# Redéploiement E-FormationGN

Comment livrer du code modifié en production.

**Production en place :** https://gandal.org — VPS Hostinger `srv1768778.hstgr.cloud` (213.130.144.215).

---

## Architecture de prod

- **Orchestration :** Docker Compose, projet `eformationgn`, dossier `/docker/e-formationgn/` sur le VPS.
- **Conteneurs :** `db` (PostgreSQL 16) · `app` (Next.js) · `cron` (nettoyage quotidien). Pas de Caddy.
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

---

## Redéployer (à chaque modif de code)

### 1. Mac — build + push

```bash
cd ~/e-formationgn
npm run deploy            # = ./scripts/deploy.sh
```

Le script build l'image `linux/amd64` et la pousse sur Docker Hub sous deux tags : `latest` **et** le SHA git court (pour le rollback). Durée : ~3-8 min.

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

### 2. VPS — pull + redémarrage

Dans le Terminal Hostinger :

```bash
cd /docker/e-formationgn
docker compose pull app
docker compose up -d app
docker compose ps
curl -fsS http://127.0.0.1:3300/api/health
curl -fsS -o /dev/null http://127.0.0.1:3300/
```

`up -d` ne recrée que le conteneur `app` (nouvelle image). `db` et son volume ne sont **pas** touchés. Les migrations Prisma s'appliquent au boot.

> **Tout depuis le Mac en une commande :** configure un accès SSH par clé au VPS, puis :
> ```bash
> export VPS_SSH=root@213.130.144.215
>
> La clé par défaut est refusée par l'hôte : utiliser `~/.ssh/claude_deploy`
> (ou `~/.ssh/deploy_key`). Exemple :
> `ssh -i ~/.ssh/claude_deploy root@213.130.144.215`
> npm run deploy
> ```
> Le script enchaîne alors le `pull` + `up -d` du service `app`, attend son
> healthcheck (180 s maximum), puis teste `/api/health` et la page d'accueil.
> En cas d'échec, il affiche l'état et les logs du conteneur puis s'arrête.

### 3. Vérifier

```bash
docker compose ps                          # app = Up (healthy)
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

Le [docker-compose.yml](docker-compose.yml) du repo est la **source de vérité**. Après modification, recopie-le sur le VPS dans `/docker/e-formationgn/docker-compose.yml` avant `docker compose up -d`.

---

## Points de vigilance

- **Ne jamais supprimer** le dossier `/docker/e-formationgn/` ni le volume `eformationgn_db_data`.
- Garde une **copie sûre du `.env`** (gestionnaire de mots de passe) — il a déjà été perdu une fois ; il a fallu le reconstruire depuis le conteneur.
- Mot de passe Postgres : **hex uniquement** (`openssl rand -hex 24`). Un mot de passe base64 (caractères `+` `/`) casse le parseur de connexion `pg` au runtime (`28P01`), alors même que `prisma migrate deploy` l'accepte.
- Sauvegarde DB : utiliser le dépôt restic chiffré hors site et le drill isolé
  décrits dans [DEPLOY.md](DEPLOY.md). Un dump stocké uniquement sur le VPS ne
  constitue pas un plan de reprise.

---

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
