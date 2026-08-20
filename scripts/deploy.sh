#!/usr/bin/env bash
# Déploiement E-FormationGN — build sur le Mac (Apple Silicon) → Docker Hub.
#
# Usage :   ./scripts/deploy.sh        (ou : npm run deploy)
#
# Build l'image en linux/amd64 (le VPS est x86_64) et la pousse sur Docker Hub
# sous deux tags : `latest` et le SHA git court (pour pouvoir revenir en arrière).
# Le VPS ne builde jamais : il fait `docker compose pull`. Voir REDEPLOY.md.
set -euo pipefail

REPO="bahm2062/e-formationgn"

cd "$(dirname "$0")/.."

# Docker Desktop fournit le credential helper ; sans ce PATH, le push échoue
# avec "docker-credential-desktop not found".
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

# Une image taggée avec un SHA doit correspondre exactement à ce commit : sans
# ce garde-fou, un fichier modifié ou non suivi produirait une image impossible à
# reproduire et rendrait le rollback trompeur.
if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  echo "❌ Le dépôt contient des modifications ou fichiers non suivis." >&2
  echo "   Committez ou retirez-les avant de construire une image de production." >&2
  git status --short >&2
  exit 1
fi

BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [ -z "${BRANCH}" ]; then
  echo "❌ HEAD est détaché : le déploiement exige une branche publiée sur origin." >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "❌ Remote Git 'origin' absent : impossible de vérifier le commit publié." >&2
  exit 1
fi

echo "▶ Vérification de la branche origin/${BRANCH}…"
git fetch --quiet origin "${BRANCH}"
HEAD_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/${BRANCH}" 2>/dev/null || true)"
if [ -z "${REMOTE_SHA}" ] || [ "${HEAD_SHA}" != "${REMOTE_SHA}" ]; then
  echo "❌ HEAD (${HEAD_SHA}) n'est pas synchronisé avec origin/${BRANCH} (${REMOTE_SHA:-absent})." >&2
  echo "   Poussez le commit exact avant de construire l'image." >&2
  exit 1
fi

TAG="$(git rev-parse --short HEAD)"

# Typage + lint AVANT le build, en natif.
#
# `next.config.ts` désactive ces deux passes à l'intérieur de `next build` :
# émulées en amd64 sur un Mac ARM, elles dépassaient l'heure pour un travail
# qui prend quelques secondes ici. Ce bloc est donc ce qui empêche une erreur
# de typage de partir en production — `set -e` interrompt le script avant le
# build si l'une des deux échoue. Ne pas le retirer sans réactiver les
# contrôles dans next.config.ts.
echo "▶ Vérifications natives (typage + lint + tests) avant build…"
npm run typecheck
npm run lint
# Les tests unitaires couvrent la validation des verdicts CinetPay — le code
# qui décide si un paiement est réputé encaissé. Ils existaient sans qu'aucune
# commande ne les exécute ; ils gardent maintenant le build, comme le typage.
npm run test:unit
npm run test:scripts
echo "✅ Typage, lint et tests OK."
echo

# Variables publiques : injectées AU BUILD, depuis .env.deploy.
#
# Next.js remplace chaque `process.env.NEXT_PUBLIC_*` par sa valeur littérale
# pendant la compilation. Une variable posée seulement dans docker-compose
# n'atteint donc jamais le navigateur — elle serait embarquée vide.
#
# La source est `.env.deploy` (non versionné), PAS `.env` : ce dernier porte
# les valeurs de développement, et lire `localhost:3000` ici enverrait cette
# adresse dans l'image de production. Sans `.env.deploy`, on retombe sur les
# valeurs de production ci-dessous.
if [ -f .env.deploy ]; then
  eval "$(grep -E '^NEXT_PUBLIC_[A-Z0-9_]+=' .env.deploy | sed 's/^/export /')"
fi
: "${NEXT_PUBLIC_APP_URL:=}"
: "${NEXT_PUBLIC_APP_NAME:=Gandal}"
: "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:=}"
: "${NEXT_PUBLIC_SENTRY_DSN:=}"
: "${NEXT_PUBLIC_PLATFORM_MODE:=}"

case "${NEXT_PUBLIC_PLATFORM_MODE}" in
  marketplace|centre_formation) ;;
  *)
    echo "❌ NEXT_PUBLIC_PLATFORM_MODE doit être explicitement défini dans .env.deploy" >&2
    echo "   avec la valeur marketplace ou centre_formation." >&2
    exit 1
    ;;
esac

if [ -z "${NEXT_PUBLIC_SENTRY_DSN}" ]; then
  echo "❌ NEXT_PUBLIC_SENTRY_DSN est obligatoire dans .env.deploy." >&2
  exit 1
fi
if [ -z "${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" ]; then
  echo "❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY est obligatoire dans .env.deploy." >&2
  exit 1
fi

echo "▶ Variables publiques embarquées dans l'image :"
printf "    NEXT_PUBLIC_APP_URL            = %s\n" "${NEXT_PUBLIC_APP_URL}"
printf "    NEXT_PUBLIC_PLATFORM_MODE      = %s\n" "${NEXT_PUBLIC_PLATFORM_MODE}"
printf "    NEXT_PUBLIC_TURNSTILE_SITE_KEY = %s\n" \
  "$([ -n "${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" ] && echo 'définie' || echo 'ABSENTE → aucun captcha sur connexion/inscription')"
printf "    NEXT_PUBLIC_SENTRY_DSN         = %s\n" \
  "$([ -n "${NEXT_PUBLIC_SENTRY_DSN}" ] && echo 'définie' || echo 'absente → pas de supervision client')"
echo

case "${NEXT_PUBLIC_APP_URL}" in
  https://*) ;;
  *)
    echo "❌ NEXT_PUBLIC_APP_URL = ${NEXT_PUBLIC_APP_URL}"
    echo "   Une URL HTTPS de production explicite est obligatoire dans .env.deploy ;"
    echo "   sitemap, canonical et liens de courriel la reprennent au build."
    exit 1
    ;;
esac

# Les secrets restent exclusivement sur le VPS. Aucun artefact de production
# n'est publié sans préflight strict sur la configuration qui l'exécutera.
if [ -z "${VPS_SSH:-}" ]; then
  echo "❌ VPS_SSH est obligatoire pour le préflight strict de production." >&2
  echo "   Le script refuse de pousser une image non validée contre son runtime." >&2
  exit 1
fi
if [ -n "${VPS_SSH:-}" ]; then
  echo "▶ Préflight des variables runtime sur ${VPS_SSH}…"
  ssh "${VPS_SSH}" sh -s -- "${NEXT_PUBLIC_PLATFORM_MODE}" \
    "${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" "${NEXT_PUBLIC_APP_URL}" 1 \
    "${NEXT_PUBLIC_SENTRY_DSN}" \
    < scripts/validate-production-env.sh
fi

echo "▶ Build linux/amd64 → ${REPO}:latest + ${REPO}:${TAG}"
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}" \
  --build-arg NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME}" \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" \
  --build-arg NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN}" \
  --build-arg NEXT_PUBLIC_PLATFORM_MODE="${NEXT_PUBLIC_PLATFORM_MODE}" \
  -t "${REPO}:latest" \
  -t "${REPO}:${TAG}" \
  --push .

echo
echo "✅ Image poussée : ${REPO}:latest  (et :${TAG})"
echo

if [ -n "${VPS_SSH:-}" ]; then
  echo "▶ Redéploiement distant sur ${VPS_SSH} ..."
  ssh "${VPS_SSH}" 'sh -s' <<'REMOTE_DEPLOY'
set -eu
cd /docker/e-formationgn

current_container="$(docker compose ps -q app)"
previous_image_id=""
if [ -n "${current_container}" ]; then
  previous_image_id="$(docker inspect --format '{{.Image}}' "${current_container}" 2>/dev/null || true)"
fi

deployment_failed() {
  echo "❌ Le nouveau conteneur n'a pas passé les contrôles de production." >&2
  docker compose ps >&2 || true
  docker compose logs --tail=120 app >&2 || true
  if [ -n "${previous_image_id}" ]; then
    echo "   Image précédente encore identifiable : ${previous_image_id}" >&2
  fi
  echo "   Rollback automatique non exécuté : les migrations Prisma appliquées" >&2
  echo "   au démarrage peuvent être incompatibles avec l'ancien binaire." >&2
  echo "   Suivez la procédure d'intervention de REDEPLOY.md après vérification DB." >&2
  exit 1
}

docker compose pull app || deployment_failed
docker compose up -d app || deployment_failed

container_id="$(docker compose ps -q app)"
[ -n "${container_id}" ] || deployment_failed

echo "▶ Attente du healthcheck applicatif (180 s maximum)…"
attempt=0
while [ "${attempt}" -lt 60 ]; do
  health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
  if [ "${health_status}" = "healthy" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 3
done
[ "${health_status:-}" = "healthy" ] || deployment_failed

echo "▶ Smoke tests locaux via nginx upstream…"
curl -fsS --max-time 10 http://127.0.0.1:3300/api/health >/dev/null || deployment_failed
curl -fsS --max-time 15 http://127.0.0.1:3300/ >/dev/null || deployment_failed

docker compose ps app
echo "✅ Healthcheck et smoke tests réussis."
REMOTE_DEPLOY
  echo
  echo "✅ Redéployé et validé localement sur le VPS. Vérifie : https://gandal.org"
else
  echo "Étape suivante — sur le VPS (Terminal Hostinger) :"
  echo "    cd /docker/e-formationgn && docker compose pull app && docker compose up -d app"
  echo
  echo "Astuce : pour enchaîner automatiquement le redéploiement du VPS, configure"
  echo "un accès SSH par clé puis exporte la variable avant de relancer ce script :"
  echo "    export VPS_SSH=root@srv1643859.hstgr.cloud"
fi
