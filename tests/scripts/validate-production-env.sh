#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/../.." && pwd)"
validator="${root_dir}/scripts/validate-production-env.sh"
fixture="$(mktemp)"
trap 'rm -f "${fixture}" "${fixture}.bak"' EXIT

write_valid_fixture() {
  printf '%s\n' \
    'DATABASE_URL=postgresql://example' \
    'DIRECT_URL=postgresql://example' \
    'NEXTAUTH_URL=https://gandal.org' \
    'NEXTAUTH_SECRET=not-a-real-secret' \
    'CRON_SECRET=not-a-real-secret' \
    'CSP_MODE=enforce' \
    'PLATFORM_MODE=centre_formation' \
    'TURNSTILE_SECRET_KEY=not-a-real-secret' \
    'UPSTASH_REDIS_REST_URL=https://example.invalid' \
    'UPSTASH_REDIS_REST_TOKEN=not-a-real-secret' > "${fixture}"
}

write_valid_fixture
PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  REQUIRE_TURNSTILE=1 "${validator}" >/dev/null

sed -i.bak '/UPSTASH_REDIS_REST_TOKEN/d' "${fixture}"
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=centre_formation \
  REQUIRE_TURNSTILE=1 "${validator}" >/dev/null 2>&1; then
  echo "La configuration Upstash partielle aurait dû échouer." >&2
  exit 1
fi

write_valid_fixture
if PRODUCTION_ENV_FILE="${fixture}" EXPECTED_PLATFORM_MODE=marketplace \
  REQUIRE_TURNSTILE=1 "${validator}" >/dev/null 2>&1; then
  echo "Un mode public/runtime différent aurait dû échouer." >&2
  exit 1
fi

echo "validate-production-env: PASS"
