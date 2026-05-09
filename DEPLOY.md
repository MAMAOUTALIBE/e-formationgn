# Déploiement E-FormationGN — VPS Hostinger + Docker

Guide complet pour déployer en production sur un VPS Hostinger (Ubuntu 22.04+).

## 1. Pré-requis VPS

- VPS Hostinger Ubuntu 22.04+ (au moins 2 vCPU, 4 GB RAM, 40 GB SSD recommandés)
- Nom de domaine pointant vers l'IP du VPS (record `A`)
- Accès SSH root (ou utilisateur sudo)

### Installation Docker

```bash
ssh root@<IP_VPS>

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Vérifie
docker --version
docker compose version
```

### Ouverture des ports

```bash
# UFW (déjà installé sur Ubuntu Hostinger)
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP (Caddy redirige vers HTTPS)
ufw allow 443/tcp       # HTTPS
ufw allow 443/udp       # HTTP/3
ufw enable
ufw status
```

### DNS

Dans le panneau Hostinger DNS du domaine :

| Type | Nom | Valeur          | TTL |
| ---- | --- | --------------- | --- |
| A    | @   | `<IP_VPS>`      | 300 |
| A    | www | `<IP_VPS>`      | 300 |

Attends que `dig +short e-formation.example.com` renvoie l'IP du VPS avant de continuer (sinon Let's Encrypt échouera).

## 2. Récupération du code

```bash
mkdir -p /opt && cd /opt
git clone <URL_DU_REPO> e-formationgn
cd e-formationgn/e-formationgn
```

## 3. Configuration des variables d'environnement

```bash
cp .env.production.example .env
nano .env
```

Renseigne au minimum :

- `DOMAIN` (ex: `e-formation.mondomaine.gn`)
- `ACME_EMAIL` (pour Let's Encrypt)
- `POSTGRES_PASSWORD` — `openssl rand -base64 24`
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `CRON_SECRET` — `openssl rand -hex 32`

Renseigne ensuite (au fur et à mesure) :

- Stripe (clés live + Connect + webhook secret)
- Mux (token id/secret + webhook secret)
- Resend (API key + domaine vérifié)
- R2 (compte Cloudflare + clés API + bucket)
- Sentry DSN (optionnel)
- Google OAuth (optionnel)

## 4. Build & démarrage

```bash
# Build de l'image (~3-5 min la première fois)
docker compose build

# Démarrage en arrière-plan
docker compose up -d

# Suivi des logs
docker compose logs -f app
docker compose logs -f caddy
```

À la première montée :

1. `db` démarre, healthcheck pg_isready
2. `app` attend la DB joignable, lance `prisma migrate deploy`, puis `node server.js`
3. `caddy` attend que `app` soit healthy, puis demande un certificat Let's Encrypt
4. `cron` enregistre la tâche journalière de nettoyage

Une fois prêt : ouvre `https://${DOMAIN}` dans le navigateur.

## 5. Vérification post-déploiement

```bash
# Healthcheck
curl -fsS https://${DOMAIN}/api/health
# → {"status":"ok","uptimeSeconds":..,"latencyMs":..}

# Conteneurs healthy ?
docker compose ps

# Logs sans erreur ?
docker compose logs --tail=50 app
```

## 6. Configuration des webhooks externes

### Stripe

1. https://dashboard.stripe.com/webhooks → Add endpoint
2. URL : `https://${DOMAIN}/api/webhooks/stripe`
3. Events à abonner :
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - `account.updated`
   - `payout.paid`
   - `payout.failed`
4. Récupère le **Signing secret** → `STRIPE_WEBHOOK_SECRET`
5. `docker compose up -d` pour appliquer la nouvelle var

### Mux

1. https://dashboard.mux.com/settings/webhooks → Create webhook
2. URL : `https://${DOMAIN}/api/webhooks/mux`
3. Récupère le **Signing secret** → `MUX_WEBHOOK_SECRET`

### Resend

1. https://resend.com/domains → Add Domain
2. Ajoute les records DNS (SPF, DKIM) dans Hostinger
3. Attends la validation (~5-30 min)
4. `RESEND_FROM_EMAIL=...@<domaine_validé>`

## 7. Création du premier admin

Une fois l'app accessible :

1. Inscris-toi via `https://${DOMAIN}/inscription` avec ton email principal
2. Vérifie l'email (clic sur le lien Resend)
3. Promote le compte en ADMIN via la base :

```bash
docker compose exec db psql -U eformationgn -d eformationgn \
  -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'ton-email@exemple.com';"
```

4. Reconnecte-toi → tu as accès à `/admin`

## 8. Maintenance

### Mise à jour du code

```bash
cd /opt/e-formationgn/e-formationgn
git pull
docker compose build app
docker compose up -d app
# Les migrations Prisma s'appliquent au démarrage via docker-entrypoint.sh
```

### Sauvegarde Postgres

```bash
# Dump quotidien (à mettre en cron système)
docker compose exec -T db pg_dump -U eformationgn eformationgn \
  | gzip > /var/backups/efgn-$(date +%F).sql.gz

# Restauration
gunzip < /var/backups/efgn-2026-01-15.sql.gz \
  | docker compose exec -T db psql -U eformationgn eformationgn
```

Cron système suggéré dans `/etc/cron.daily/efgn-backup` :

```bash
#!/bin/bash
mkdir -p /var/backups/efgn
cd /opt/e-formationgn/e-formationgn
docker compose exec -T db pg_dump -U eformationgn eformationgn \
  | gzip > /var/backups/efgn/efgn-$(date +%F).sql.gz
find /var/backups/efgn -mtime +30 -delete
```

### Rotation des secrets

`NEXTAUTH_SECRET` ne peut pas être changé sans déconnecter tous les utilisateurs. Pour les autres secrets (Stripe/Mux/Resend), édite `.env` et `docker compose up -d app` (recrée le conteneur).

### Monitoring

- **Healthcheck** : Docker check toutes les 30 s sur `/api/health`
- **Sentry** : si `SENTRY_DSN` est configuré, toutes les erreurs serveur remontent
- **UptimeRobot / BetterStack** (gratuit) : pointe sur `https://${DOMAIN}/api/health`, alerte SMS/email

## 9. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| Caddy boucle sur le challenge ACME | DNS pas encore propagé | `dig +short ${DOMAIN}` et attendre |
| `app` redémarre en boucle | Migration Prisma échoue | `docker compose logs app` puis `docker compose exec app npx prisma migrate status` |
| 503 sur `/api/webhooks/stripe` | `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` absent | Renseigne `.env` puis `docker compose up -d app` |
| Emails non envoyés | `RESEND_API_KEY` absent | App fallback : log dans stdout. Voir `docker compose logs app \| grep email` |
| 401 sur `/api/cron/cleanup` | `CRON_SECRET` côté `app` ≠ celui du `cron` | Les deux conteneurs lisent la même var depuis `.env` — recrée les deux : `docker compose up -d app cron` |

## 10. Sécurité — checklist post-déploiement

- [ ] HTTPS forcé via Caddy (HSTS preload)
- [ ] `NEXTAUTH_SECRET` 32+ chars
- [ ] `CRON_SECRET` 16+ chars (sinon refus au boot)
- [ ] Webhook Stripe : signature HMAC validée (déjà dans le code)
- [ ] Webhook Mux : signature SDK validée (déjà dans le code)
- [ ] Rate-limit auth actif (login 10/15 min, register 5/h, reset 5/h par IP)
- [ ] LoginAttempt logué en base, visible sur `/admin/securite/logs`
- [ ] CSP en mode report-only (à durcir après 48h sans violation)
- [ ] Backup DB quotidien configuré
- [ ] DNS SPF + DKIM Resend validés
- [ ] Compte admin créé et premier login OK
- [ ] Stripe webhook test → événement reçu (`stripe trigger checkout.session.completed`)
- [ ] Mux webhook test → asset upload + ready

## 11. Aller plus loin

- **Scale-out** : passer à plusieurs conteneurs `app` derrière Caddy + Upstash Redis pour rate-limit distribué
- **CDN images** : R2 + custom domain Cloudflare → cache mondial
- **Algolia** : remplacer la recherche Postgres par Algolia (plus rapide à grande échelle)
- **Kubernetes** : pour multi-VPS, migrer le `docker-compose.yml` vers Helm/K8s
