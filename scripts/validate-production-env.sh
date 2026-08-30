#!/bin/sh
# Valide les variables runtime sans jamais afficher leurs valeurs.
set -eu

env_file="${PRODUCTION_ENV_FILE:-/docker/e-formationgn/.env}"
expected_mode="${1:-${EXPECTED_PLATFORM_MODE:-}}"
expected_public_turnstile="${2:-${EXPECTED_PUBLIC_TURNSTILE_SITE_KEY:-}}"
expected_app_url="${3:-${EXPECTED_APP_URL:-}}"
strict_production="${4:-${STRICT_PRODUCTION:-0}}"
expected_public_sentry="${5:-${EXPECTED_PUBLIC_SENTRY_DSN:-}}"

# SSH concatène sa commande distante et peut perdre les arguments réellement
# vides. Le script de déploiement utilise ce marqueur pour préserver leur place.
[ "${expected_public_turnstile}" = "__AIDUCA_EMPTY__" ] && expected_public_turnstile=""
[ "${expected_public_sentry}" = "__AIDUCA_EMPTY__" ] && expected_public_sentry=""

if [ ! -r "${env_file}" ]; then
  echo "❌ Fichier d'environnement production illisible : ${env_file}" >&2
  exit 1
fi

env_value() {
  awk -F= -v wanted="$1" '
    $0 !~ /^[[:space:]]*#/ && $1 == wanted {
      sub(/^[^=]*=/, "");
      gsub(/^[[:space:]]+|[[:space:]]+$/, "");
      gsub(/^\047|\047$/, "");
      gsub(/^"|"$/, "");
      print;
      exit;
    }
  ' "${env_file}"
}

require_value() {
  if [ -z "$(env_value "$1")" ]; then
    echo "❌ Variable production obligatoire absente : $1" >&2
    return 1
  fi
}

require_value DATABASE_URL
require_value DIRECT_URL
require_value NEXTAUTH_URL
require_value NEXTAUTH_SECRET
require_value CRON_SECRET

resend_api_key="$(env_value RESEND_API_KEY)"
if [ -n "${resend_api_key}" ] &&
  ! printf '%s' "${resend_api_key}" | grep -Eq '^re_[A-Za-z0-9_-]{8,}$'; then
  echo "❌ RESEND_API_KEY doit utiliser le préfixe re_ et un format valide." >&2
  exit 1
fi
resend_from_email="$(env_value RESEND_FROM_EMAIL)"
if [ -n "${resend_from_email}" ] && ! printf '%s' "${resend_from_email}" |
  grep -Eq '^[A-Za-z0-9.!#$%&'\''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  echo "❌ RESEND_FROM_EMAIL doit être une adresse nue valide, sans display-name." >&2
  exit 1
fi

case "${strict_production}" in
  0|1) ;;
  *) echo "❌ STRICT_PRODUCTION doit valoir 0 ou 1." >&2; exit 1 ;;
esac

if [ "${strict_production}" = "1" ]; then
  require_value RESEND_API_KEY
  require_value RESEND_FROM_EMAIL
  require_value SENTRY_DSN
  require_value NEXT_PUBLIC_SENTRY_DSN
fi

for sentry_name in SENTRY_DSN NEXT_PUBLIC_SENTRY_DSN; do
  sentry_value="$(env_value "${sentry_name}")"
  if [ -n "${sentry_value}" ]; then
    case "${sentry_value}" in
      https://*/*) ;;
      *) echo "❌ ${sentry_name} doit être un DSN HTTPS valide." >&2; exit 1 ;;
    esac
    case "${sentry_value}" in
      *placeholder*|*example.invalid*|*not-a-real*|*REPLACE*)
        echo "❌ ${sentry_name} contient une valeur de remplacement." >&2
        exit 1
        ;;
    esac
  fi
done

runtime_app_url="$(env_value NEXTAUTH_URL)"
if [ -n "${expected_app_url}" ] &&
  [ "${runtime_app_url%/}" != "${expected_app_url%/}" ]; then
  echo "❌ NEXTAUTH_URL runtime ne correspond pas à NEXT_PUBLIC_APP_URL." >&2
  exit 1
fi

csp_mode="$(env_value CSP_MODE)"
case "${csp_mode}" in
  enforce|report-only) ;;
  *) echo "❌ CSP_MODE doit valoir enforce ou report-only." >&2; exit 1 ;;
esac

runtime_mode="$(env_value PLATFORM_MODE)"
case "${runtime_mode}" in
  marketplace|centre_formation) ;;
  *) echo "❌ PLATFORM_MODE doit valoir marketplace ou centre_formation." >&2; exit 1 ;;
esac
if [ -n "${expected_mode}" ] && [ "${runtime_mode}" != "${expected_mode}" ]; then
  echo "❌ PLATFORM_MODE runtime ne correspond pas au mode public embarqué." >&2
  exit 1
fi

turnstile_secret="$(env_value TURNSTILE_SECRET_KEY)"
turnstile_public="$(env_value NEXT_PUBLIC_TURNSTILE_SITE_KEY)"
if { [ -n "${turnstile_public}" ] && [ -z "${turnstile_secret}" ]; } ||
  { [ -z "${turnstile_public}" ] && [ -n "${turnstile_secret}" ]; }; then
  echo "❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY doivent être configurées ensemble." >&2
  exit 1
fi
for turnstile_name in NEXT_PUBLIC_TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY; do
  turnstile_value="$(env_value "${turnstile_name}")"
  if [ -n "${turnstile_value}" ]; then
    if ! printf '%s' "${turnstile_value}" | grep -Eq '^[A-Za-z0-9_-]{8,}$'; then
      echo "❌ ${turnstile_name} a un format invalide." >&2
      exit 1
    fi
    case "${turnstile_value}" in
      *placeholder*|*not-a-real*|*REPLACE*|*changeme*)
        echo "❌ ${turnstile_name} contient une valeur de remplacement." >&2
        exit 1
        ;;
    esac
  fi
done
if [ -n "${expected_public_turnstile}" ] &&
  [ "${turnstile_public}" != "${expected_public_turnstile}" ]; then
  echo "❌ La clé publique Turnstile runtime diffère de celle embarquée au build." >&2
  exit 1
fi
if [ "${strict_production}" = "1" ] && [ "${runtime_mode}" = "centre_formation" ] &&
  [ -z "${turnstile_public}" ]; then
  echo "❌ Turnstile est obligatoire en production centre_formation." >&2
  exit 1
fi
runtime_public_sentry="$(env_value NEXT_PUBLIC_SENTRY_DSN)"
if [ -n "${expected_public_sentry}" ] &&
  [ "${runtime_public_sentry}" != "${expected_public_sentry}" ]; then
  echo "❌ Le DSN Sentry public runtime diffère de celui embarqué au build." >&2
  exit 1
fi

redis_url="$(env_value UPSTASH_REDIS_REST_URL)"
redis_token="$(env_value UPSTASH_REDIS_REST_TOKEN)"
if { [ -n "${redis_url}" ] && [ -z "${redis_token}" ]; } ||
  { [ -z "${redis_url}" ] && [ -n "${redis_token}" ]; }; then
  echo "❌ Upstash doit être configuré avec URL et token ensemble." >&2
  exit 1
fi

mux_signed="$(env_value MUX_SIGNED_PLAYBACK)"
case "${mux_signed:-0}" in
  0) ;;
  1)
    require_value MUX_SIGNING_KEY_ID
    require_value MUX_SIGNING_KEY_PRIVATE
    ;;
  *) echo "❌ MUX_SIGNED_PLAYBACK doit valoir 0 ou 1." >&2; exit 1 ;;
esac

livekit_url="$(env_value LIVEKIT_URL)"
livekit_api_key="$(env_value LIVEKIT_API_KEY)"
livekit_api_secret="$(env_value LIVEKIT_API_SECRET)"
livekit_webhook_secret="$(env_value LIVEKIT_WEBHOOK_SECRET)"
livekit_count=0
for livekit_value in "${livekit_url}" "${livekit_api_key}" "${livekit_api_secret}" "${livekit_webhook_secret}"; do
  [ -n "${livekit_value}" ] && livekit_count=$((livekit_count + 1))
done
if [ "${livekit_count}" -ne 0 ] && [ "${livekit_count}" -ne 4 ]; then
  echo "❌ LiveKit doit être configuré avec URL, clé API, secret API et secret webhook ensemble." >&2
  exit 1
fi
if [ "${strict_production}" = "1" ] && [ "${livekit_count}" -ne 4 ]; then
  echo "❌ LiveKit est obligatoire pour activer les classes virtuelles en production stricte." >&2
  exit 1
fi
if [ -n "${livekit_url}" ]; then
  case "${livekit_url}" in
    wss://*/*|wss://*) ;;
    *) echo "❌ LIVEKIT_URL doit être une URL websocket sécurisée (wss://)." >&2; exit 1 ;;
  esac
fi

echo "✅ Variables runtime de production cohérentes (valeurs masquées)."
