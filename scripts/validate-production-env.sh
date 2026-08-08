#!/bin/sh
# Valide les variables runtime sans jamais afficher leurs valeurs.
set -eu

env_file="${PRODUCTION_ENV_FILE:-/docker/e-formationgn/.env}"
expected_mode="${1:-${EXPECTED_PLATFORM_MODE:-}}"
require_turnstile="${2:-${REQUIRE_TURNSTILE:-0}}"
expected_app_url="${3:-${EXPECTED_APP_URL:-}}"

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
if { [ "${require_turnstile}" = "1" ] && [ -z "${turnstile_secret}" ]; } ||
  { [ "${require_turnstile}" = "0" ] && [ -n "${turnstile_secret}" ]; }; then
  echo "❌ Les clés publique et secrète Turnstile doivent être activées ensemble." >&2
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

echo "✅ Variables runtime de production cohérentes (valeurs masquées)."
