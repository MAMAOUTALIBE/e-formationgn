#!/bin/sh
# Entrypoint conteneur app — applique les migrations Prisma puis lance Next.js.
# Conçu pour idempotence : peut être relancé sans risque.
set -e

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
echo "[entrypoint] Application des migrations Prisma..."
npx --no-install prisma migrate deploy

echo "[entrypoint] Démarrage de Next.js : $*"
exec "$@"
