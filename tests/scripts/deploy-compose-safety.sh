#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/../.." && pwd)"
deploy="${root_dir}/scripts/deploy.sh"
docs="${root_dir}/REDEPLOY.md"
workflow="${root_dir}/.github/workflows/build-image.yml"

line_of() {
  local pattern="$1"
  local file="$2"
  local line
  line="$(grep -nF -- "${pattern}" "${file}" | head -n 1 | cut -d: -f1)"
  if [ -z "${line}" ]; then
    echo "Motif de sécurité absent de ${file}: ${pattern}" >&2
    exit 1
  fi
  printf '%s' "${line}"
}

bash -n "${deploy}"

build_gate_line="$(line_of 'if [ "${SKIP_BUILD:-0}" = "1" ]; then' "${deploy}")"
scp_line="$(line_of 'scp -- docker-compose.yml "${VPS_SSH}:${compose_candidate_path}"' "${deploy}")"
validate_line="$(line_of 'docker compose -f "${compose_candidate}" config --quiet' "${deploy}")"
backup_line="$(line_of 'cp -p docker-compose.yml docker-compose.yml.backup' "${deploy}")"
promote_line="$(line_of 'mv -f "${compose_candidate}" docker-compose.yml' "${deploy}")"
pull_line="$(line_of 'docker compose pull app || deployment_failed' "${deploy}")"
up_line="$(line_of 'docker compose up -d app cron || deployment_failed' "${deploy}")"
health_line="$(line_of '[ "${health_status:-}" = "healthy" ] || deployment_failed' "${deploy}")"
cron_line="$(line_of 'cron_container_id="$(docker compose ps -q cron)"' "${deploy}")"

if [ "${scp_line}" -le "${build_gate_line}" ]; then
  echo "Le Compose ne doit être transféré qu'après la disponibilité de l'image." >&2
  exit 1
fi
if [ "${validate_line}" -ge "${backup_line}" ] ||
  [ "${backup_line}" -ge "${promote_line}" ] ||
  [ "${promote_line}" -ge "${pull_line}" ] ||
  [ "${pull_line}" -ge "${up_line}" ]; then
  echo "Ordre dangereux : validation, backup, promotion, pull et up sont mal séquencés." >&2
  exit 1
fi
if [ "${cron_line}" -le "${health_line}" ]; then
  echo "Le contrôle du cron doit suivre le healthcheck applicatif." >&2
  exit 1
fi

grep -Fq 'docker compose logs --tail=120 cron' "${deploy}"
grep -Fq "[ \"\${cron_status}\" = \"running\" ] || deployment_failed" "${deploy}"
grep -Fq 'docker compose ps app cron' "${deploy}"

grep -Eq 'CRON_SECRET.*(au moins 16|>= ?16)' "${docs}"
grep -Fq 'PRIVATE_UPLOAD_ROOT=/app/private-uploads' "${docs}"
grep -Eq 'R2_PRIVATE_BUCKET.*(distinct|non publié|privé)' "${docs}"
grep -Fq 'eformationgn_app_private_uploads' "${docs}"
grep -Eq 'cron.*(conversion|présentation)' "${docs}"
grep -Fq 'docker compose -f docker-compose.yml.candidate config --quiet' "${docs}"
grep -Fq 'docker compose up -d app cron' "${docs}"

grep -Fq 'SKIP_BUILD=1 VPS_SSH=root@213.130.144.215 npm run deploy' "${workflow}"
if grep -Fq 'docker compose pull app && docker compose up -d app"' "${workflow}"; then
  echo "Le résumé GitHub recommande encore le redéploiement de app seul." >&2
  exit 1
fi

echo "deploy-compose-safety: PASS"
