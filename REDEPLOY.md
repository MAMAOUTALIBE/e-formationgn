# Redéploiement E-FormationGN

L'app tourne sur **https://srv1643859.hstgr.cloud** (VPS Hostinger).

Architecture en prod :
- Image Docker publique : `bahm2062/e-formationgn:latest` (Docker Hub)
- Hostinger Docker Manager UI orchestre `app` (Next.js) + `db` (Postgres 16)
- Reverse proxy : Traefik partagé du VPS (HTTPS via Let's Encrypt)
- Build : Mac local (Apple Silicon) → cross-compilé `linux/amd64` → push Docker Hub

---

## 🔄 Procédure complète (3 étapes)

### Étape 1 — Sur le Mac (build + push)

Depuis `/Users/bahmamadou/Desktop/E-FORMATION-GUINEE/e-formationgn` :

```bash
# 1.1 — Commit + push GitHub (optionnel mais recommandé)
git add -A
git commit -m "votre message"
git push origin main

# 1.2 — Export du PATH Docker Desktop (sinon credential helper introuvable)
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

# 1.3 — Build linux/amd64 + push direct vers Docker Hub
docker buildx build --platform linux/amd64 -t bahm2062/e-formationgn:latest --push .
```

Durée : 6-10 min (build) + 2-3 min (push) la première fois ; ~3-5 min ensuite (cache).

Vérification optionnelle :
```bash
curl -s https://hub.docker.com/v2/repositories/bahm2062/e-formationgn/tags/ \
  | python3 -c "import json,sys; t=json.load(sys.stdin)['results'][0]; print('pushed:', t['tag_last_pushed'])"
```

### Étape 2 — Sur le VPS Hostinger (pull + restart)

Ouvre **Hostinger > VPS > srv1643859.hstgr.cloud > Docker Manager > Terminal** :

```bash
docker pull bahm2062/e-formationgn:latest
docker rm -f eformationgn-app
```

Puis dans **Docker Manager UI** → projet `eformationgn` → bouton **Manage** → **Redeploy** (ou Restart / Recreate).

Si le bouton n'est pas visible, recrée juste le service `app` via l'UI (le service `db` doit rester intact pour préserver le volume).

### Étape 3 — Vérification

Depuis le Terminal Hostinger :

```bash
docker ps -a --filter "name=eformationgn" --format "table {{.Names}}\t{{.Status}}"
docker logs --tail 30 eformationgn-app
```

Tu dois voir `Ready in xxxms`. Puis ouvre https://srv1643859.hstgr.cloud dans le navigateur.

---

## 🛟 Si ça plante

| Symptôme | Cause | Fix |
|---|---|---|
| Build Mac : `docker-credential-desktop not found` | PATH manque Docker.app | Exporter le PATH (cf 1.2) |
| Build Mac : `Cannot find module 'effect'` | Image obsolète sans node_modules prod complet | Vérifier que le Dockerfile a bien le stage `prod-deps` |
| Hostinger : `Partially running` | App container crashe au démarrage | `docker logs --tail 80 eformationgn-app` |
| Hostinger : 404 page not found | App pas healthy → Traefik ne route pas | Cf logs app ci-dessus |
| Build : `prerender error /_not-found` | Layout root n'est pas `force-dynamic` | Vérifier `src/app/layout.tsx` ligne `export const dynamic = "force-dynamic"` |
| Migration prisma échoue | DB pas joignable ou schéma incompatible | `docker logs eformationgn-db` ; vérifier `DATABASE_URL` dans le YAML compose |

---

## 🔐 Secrets en place (à NE PAS changer sauf reset complet)

Stockés dans le YAML compose côté Hostinger Docker Manager :

- `POSTGRES_PASSWORD` — accès DB (changer = perdre l'accès aux données)
- `NEXTAUTH_SECRET` / `AUTH_SECRET` — signature JWT (changer = déconnecter tous les users)
- `CRON_SECRET` — auth /api/cron/cleanup

Si tu dois les rotater, mets à jour le YAML dans Docker Manager et `docker compose up -d` recrée les conteneurs.

---

## 📊 Volumes persistants

- `efgn_db` (volume Docker nommé) — données Postgres. **Ne jamais supprimer** sauf reset volontaire.
- Backup recommandé : `docker exec eformationgn-db pg_dump -U eformationgn eformationgn | gzip > backup-$(date +%F).sql.gz`

---

## 🚀 Premier déploiement (référence historique)

Voir [DEPLOY.md](DEPLOY.md) pour la mise en place initiale (DNS, secrets, premier admin).
