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

# Tag de version = SHA git court (sert au rollback). "nogit" hors dépôt git.
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"

if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo "⚠️  Modifications non commitées : elles seront incluses dans l'image (tag $TAG)."
fi

# Typage + lint AVANT le build, en natif.
#
# `next.config.ts` désactive ces deux passes à l'intérieur de `next build` :
# émulées en amd64 sur un Mac ARM, elles dépassaient l'heure pour un travail
# qui prend quelques secondes ici. Ce bloc est donc ce qui empêche une erreur
# de typage de partir en production — `set -e` interrompt le script avant le
# build si l'une des deux échoue. Ne pas le retirer sans réactiver les
# contrôles dans next.config.ts.
echo "▶ Vérifications natives (typage + lint) avant build…"
npm run typecheck
npm run lint
echo "✅ Typage et lint OK."
echo

echo "▶ Build linux/amd64 → ${REPO}:latest + ${REPO}:${TAG}"
docker buildx build \
  --platform linux/amd64 \
  -t "${REPO}:latest" \
  -t "${REPO}:${TAG}" \
  --push .

echo
echo "✅ Image poussée : ${REPO}:latest  (et :${TAG})"
echo

if [ -n "${VPS_SSH:-}" ]; then
  echo "▶ Redéploiement distant sur ${VPS_SSH} ..."
  ssh "${VPS_SSH}" 'cd /docker/e-formationgn && docker compose pull && docker compose up -d && docker compose ps'
  echo
  echo "✅ Redéployé. Vérifie : https://gandal.org"
else
  echo "Étape suivante — sur le VPS (Terminal Hostinger) :"
  echo "    cd /docker/e-formationgn && docker compose pull && docker compose up -d"
  echo
  echo "Astuce : pour enchaîner automatiquement le redéploiement du VPS, configure"
  echo "un accès SSH par clé puis exporte la variable avant de relancer ce script :"
  echo "    export VPS_SSH=root@srv1643859.hstgr.cloud"
fi
