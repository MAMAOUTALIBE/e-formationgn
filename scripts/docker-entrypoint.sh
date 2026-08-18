#!/bin/sh
# Entrypoint conteneur app — applique les migrations Prisma puis lance Next.js.
# Conçu pour idempotence : peut être relancé sans risque.
set -e

# Un volume Docker neuf est créé avec root:root, même si le dossier de l'image
# appartient à nextjs. Prépare le volume persistant puis redémarre immédiatement
# l'entrypoint avec l'utilisateur non privilégié de l'application.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/public/uploads
  chown -R nextjs:nodejs /app/public/uploads
  chmod -R u+rwX /app/public/uploads
  exec su-exec nextjs:nodejs "$0" "$@"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL absent. Abandon." >&2
  exit 1
fi

# Attente DB joignable (au cas où le conteneur app démarre avant postgres).
echo "[entrypoint] Vérification de la disponibilité de la base..."
i=0
until node -e "
  const url = new URL(process.env.DATABASE_URL);
  const net = require('net');
  const sock = net.createConnection({ host: url.hostname, port: url.port || 5432 });
  sock.once('connect', () => { sock.end(); process.exit(0); });
  sock.once('error', () => process.exit(1));
" >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then
    echo "[entrypoint] DB injoignable après 30s. Abandon." >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] Base joignable."

# Applique les migrations en attente. Idempotent.
# On appelle le binaire prisma via son shim (node_modules/.bin/prisma) qui est
# présent maintenant que le node_modules production complet est copié dans
# l'image — il porte les transitive deps (effect, c12, etc.) que le CLI
# requiert via @prisma/config au démarrage.
echo "[entrypoint] Application des migrations Prisma..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Démarrage de Next.js : $*"
exec "$@"
