#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/../.." && pwd)"
validator="${root_dir}/scripts/validate-production-env.sh"
fixture="$(mktemp)"
trap 'rm -f "${fixture}" "${fixture}.bak"' EXIT

production_example_from="$(sed -n 's/^RESEND_FROM_EMAIL=//p' "${root_dir}/.env.production.example")"
if ! printf '%s' "${production_example_from}" |
  grep -Eq '^[A-Za-z0-9.!#$%&'\''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  echo ".env.production.example doit fournir une adresse Resend nue valide." >&2
  exit 1
fi

write_valid_fixture() {
  printf '%s\n' \
    'DATABASE_URL=postgresql://example' \
    'DIRECT_URL=postgresql://example' \
    'NEXTAUTH_URL=https://gandal.org' \
    'NEXTAUTH_SECRET=not-a-real-secret' \
    'CRON_SECRET=not-a-real-secret' \
    'RESEND_API_KEY=re_1234567890abcdef' \
    'RESEND_FROM_EMAIL=no-reply@aiduca.fr' \
    'CSP_MODE=enforce' \
    'PLATFORM_MODE=centre_formation' \
    'SENTRY_DSN=https://server@sentry.aiduca.test/1' \
    'NEXT_PUBLIC_SENTRY_DSN=https://public@sentry.aiduca.test/1' \
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA' \
    'TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA' \
    'UPSTASH_REDIS_REST_URL=https://example.invalid' \
    'UPSTASH_REDIS_REST_TOKEN=not-a-real-secret' \
    'LIVEKIT_URL=wss://aiduca-test.livekit.cloud' \
    'LIVEKIT_API_KEY=APItestkey' \
    'LIVEKIT_API_SECRET=secret-livekit-test' \
    'LIVEKIT_WEBHOOK_SECRET=secret-webhook-test' > "${fixture}"
}

write_valid_fixture
PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  EXPECTED_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  EXPECTED_PUBLIC_SENTRY_DSN=https://public@sentry.aiduca.test/1 \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null

# Même contrat que deploy.sh : les valeurs publiques sont transmises en args
# et comparées à leurs copies runtime sans jamais être imprimées.
PRODUCTION_ENV_FILE="${fixture}" "${validator}" centre_formation \
  1x00000000000000000000AA https://gandal.org 1 \
  https://public@sentry.aiduca.test/1 >/dev/null

sed -i.bak '/RESEND_API_KEY/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Une production stricte sans fournisseur email aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak '/^SENTRY_DSN=/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Une production stricte sans Sentry aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak '/^RESEND_API_KEY=/d' "${fixture}"
sed -i.bak '/^RESEND_FROM_EMAIL=/d' "${fixture}"
PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  STRICT_PRODUCTION=0 "${validator}" >/dev/null

if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Une production stricte sans Resend aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak '/NEXT_PUBLIC_TURNSTILE_SITE_KEY/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Une configuration Turnstile partielle aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak '/UPSTASH_REDIS_REST_TOKEN/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null 2>&1; then
  echo "La configuration Upstash partielle aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
printf '%s\n' \
  'R2_ACCOUNT_ID=account-test' \
  'R2_ACCESS_KEY_ID=access-test' \
  'R2_SECRET_ACCESS_KEY=secret-test' \
  'R2_BUCKET=aiduca-public' >> "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null 2>&1; then
  echo "Une configuration R2 sans bucket privé aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
printf '%s\n' 'PRIVATE_UPLOAD_ROOT=relative/private-uploads' >> "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null 2>&1; then
  echo "Un chemin de stockage privé relatif aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
printf '%s\n' 'PRIVATE_UPLOAD_ROOT=/app/public/private-uploads' >> "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null 2>&1; then
  echo "Un stockage privé sous public aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
printf '%s\n' 'PRIVATE_UPLOAD_ROOT=/app/private-uploads' >> "${fixture}"
PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null

write_valid_fixture
printf '%s\n' \
  'R2_ACCOUNT_ID=account-test' \
  'R2_ACCESS_KEY_ID=access-test' \
  'R2_SECRET_ACCESS_KEY=secret-test' \
  'R2_BUCKET=aiduca-public' \
  'R2_PRIVATE_BUCKET=aiduca-private' >> "${fixture}"
PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null

sed -i.bak 's/^R2_PRIVATE_BUCKET=.*/R2_PRIVATE_BUCKET=aiduca-public/' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null 2>&1; then
  echo "Un bucket R2 privé identique au bucket public aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak '/LIVEKIT_WEBHOOK_SECRET/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  "${validator}" >/dev/null 2>&1; then
  echo "Une configuration LiveKit partielle aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak '/^LIVEKIT_/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Une production stricte sans LiveKit aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=marketplace \
  "${validator}" >/dev/null 2>&1; then
  echo "Un mode public/runtime différent aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  EXPECTED_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000BB \
  EXPECTED_PUBLIC_SENTRY_DSN=https://public@sentry.aiduca.test/1 \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Une clé Turnstile runtime différente du build aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  EXPECTED_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  EXPECTED_PUBLIC_SENTRY_DSN=https://other@sentry.aiduca.test/1 \
  STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Un DSN Sentry runtime différent du build aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak 's/^RESEND_FROM_EMAIL=.*/RESEND_FROM_EMAIL=Aiduca <no-reply@aiduca.fr>/' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" "${validator}" >/dev/null 2>&1; then
  echo "Un expéditeur Resend avec display-name aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak 's/^RESEND_API_KEY=.*/RESEND_API_KEY=invalid_key/' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" "${validator}" >/dev/null 2>&1; then
  echo "Une clé Resend sans préfixe re_ aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak 's#^NEXT_PUBLIC_SENTRY_DSN=.*#NEXT_PUBLIC_SENTRY_DSN=http://sentry.aiduca.test/1#' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" STRICT_PRODUCTION=1 "${validator}" >/dev/null 2>&1; then
  echo "Un DSN Sentry non HTTPS aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
sed -i.bak 's/^TURNSTILE_SECRET_KEY=.*/TURNSTILE_SECRET_KEY=bad key!/' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" "${validator}" >/dev/null 2>&1; then
  echo "Une clé Turnstile mal formée aurait dû échouer." >&2
  exit 1
fi

# Le fichier d'exemple livré est ce que l'exploitant copie pour composer son
# `.env` de production (cf. DEPLOY.md / REDEPLOY.md). Il doit donc passer ce
# validateur tel quel : il annonçait NEXT_PUBLIC_PLATFORM_MODE=centre_formation
# en haut et PLATFORM_MODE=marketplace en bas, deux valeurs que le validateur
# exige justement identiques — le déploiement était refusé pour qui suivait la
# documentation à la lettre.
example="${root_dir}/.env.production.example"
if [ ! -f "${example}" ]; then
  echo "Fichier .env.production.example introuvable." >&2
  exit 1
fi
expected_public="$(sed -n 's/^NEXT_PUBLIC_PLATFORM_MODE=//p' "${example}" | tr -d '"' | head -n 1)"
if [ -z "${expected_public}" ]; then
  echo "NEXT_PUBLIC_PLATFORM_MODE absent de .env.production.example." >&2
  exit 1
fi
if ! PRODUCTION_ENV_FILE="${example}" EXPECTED_PLATFORM_MODE="${expected_public}" \
  "${validator}" >/dev/null 2>&1; then
  echo ".env.production.example ne passe pas le validateur de production." >&2
  exit 1
fi

echo "validate-production-env: PASS"
