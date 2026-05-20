# Redéploiement E-FormationGN

Comment livrer du code modifié en production.

**Production en place :** https://gandal.org — VPS Hostinger `srv1643859.hstgr.cloud`.

---

## Architecture de prod

- **Orchestration :** Docker Compose, projet `eformationgn`, dossier `/docker/e-formationgn/` sur le VPS.
- **Conteneurs :** `db` (PostgreSQL 16) · `app` (Next.js) · `cron` (nettoyage quotidien). Pas de Caddy.
- **Image :** `bahm2062/e-formationgn` sur Docker Hub. Buildée **sur le Mac** (Apple Silicon) en `linux/amd64`, **jamais sur le VPS** (VPS trop chargé).
- **Reverse proxy / HTTPS :** Traefik mutualisé du VPS (`traefik-zcbs`), branché via les *labels* du service `app` ([docker-compose.yml](docker-compose.yml)). Certificat Let's Encrypt automatique.
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

### 2. VPS — pull + redémarrage

Dans le Terminal Hostinger :

```bash
cd /docker/e-formationgn
docker compose pull
docker compose up -d
docker compose ps
```

`up -d` ne recrée que le conteneur `app` (nouvelle image). `db` et son volume ne sont **pas** touchés. Les migrations Prisma s'appliquent au boot.

> **Tout depuis le Mac en une commande :** configure un accès SSH par clé au VPS, puis :
> ```bash
> export VPS_SSH=root@srv1643859.hstgr.cloud
> npm run deploy
> ```
> Le script enchaîne alors automatiquement le `pull` + `up -d` sur le VPS.

### 3. Vérifier

```bash
docker compose ps                          # app = Up (healthy)
curl -sI https://gandal.org | head -1      # HTTP/2 200
```

---

## Rollback (revenir à une version précédente)

Chaque build est taggé avec le SHA git. Tags disponibles : https://hub.docker.com/r/bahm2062/e-formationgn/tags

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
- Sauvegarde DB recommandée (cron système sur le VPS) :
  ```bash
  docker exec eformationgn-db-1 pg_dump -U postgres postgres | gzip > efgn-$(date +%F).sql.gz
  ```

---

## Dépannage

| Symptôme | Cause | Action |
|---|---|---|
| Build Mac : `docker-credential-desktop not found` | PATH sans Docker.app | Le script exporte déjà le PATH ; sinon : `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` |
| `docker compose pull` : `denied` / `not found` | Pas connecté à Docker Hub | `docker login` sur le Mac |
| `app` en `Restarting` après un deploy | Migration Prisma ou variable d'env | `docker logs --tail 80 eformationgn-app-1` |
| `28P01 password authentication failed` | Mot de passe DB non URL-safe | Cf. note « hex uniquement » ci-dessus |
| `502 Bad Gateway` sur le domaine | `app` pas `(healthy)` → Traefik ne route pas | `docker compose ps` puis logs `app` |
| Le site ne change pas après un deploy | Vieille image encore en cache | Vérifier que `docker compose pull` a bien tiré un nouveau digest |

---

## Premier déploiement / mise en place initiale

Voir [DEPLOY.md](DEPLOY.md) (DNS, secrets, création du premier admin).
