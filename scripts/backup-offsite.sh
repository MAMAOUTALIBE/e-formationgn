#!/usr/bin/env bash
# Sauvegarde PostgreSQL chiffrée hors site avec restic.
# Par défaut, ce script ne fait qu'afficher le plan. Utiliser --execute après
# avoir configuré un dépôt restic distant (S3, SFTP, rclone, etc.).
set -euo pipefail

mode="${1:---dry-run}"
compose_dir="${COMPOSE_DIR:-/docker/e-formationgn}"
repository="${RESTIC_REPOSITORY:-}"
password_file="${RESTIC_PASSWORD_FILE:-}"

validate_remote_repository() {
  case "$1" in
    s3:*|sftp:*|rclone:*|rest:https://*) return 0 ;;
    *)
      echo "❌ RESTIC_REPOSITORY doit être distant : s3:, sftp:, rclone: ou rest:https://." >&2
      return 1
      ;;
  esac
}

# Une valeur fournie est contrôlée même en dry-run : un chemin local ne doit
# jamais pouvoir donner une fausse impression de sauvegarde hors site.
if [ -n "${repository}" ]; then
  validate_remote_repository "${repository}"
fi

case "${mode}" in
  --dry-run)
    echo "DRY-RUN: dump PostgreSQL Docker -> flux restic chiffré hors site."
    echo "DRY-RUN: aucun dump local persistant, aucun secret affiché."
    echo "DRY-RUN: définir RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE et lancer --execute."
    exit 0
    ;;
  --execute) ;;
  *) echo "Usage: $0 [--dry-run|--execute]" >&2; exit 2 ;;
esac

[ -d "${compose_dir}" ] || { echo "❌ COMPOSE_DIR introuvable." >&2; exit 1; }
[ -n "${repository}" ] || { echo "❌ RESTIC_REPOSITORY est obligatoire." >&2; exit 1; }
validate_remote_repository "${repository}"
[ -r "${password_file}" ] || { echo "❌ RESTIC_PASSWORD_FILE doit être lisible." >&2; exit 1; }
command -v docker >/dev/null || { echo "❌ docker est introuvable." >&2; exit 1; }
command -v restic >/dev/null || { echo "❌ restic est introuvable." >&2; exit 1; }

cd "${compose_dir}"
docker compose ps --status running db --quiet | grep -q . || {
  echo "❌ Le service PostgreSQL db n'est pas démarré." >&2
  exit 1
}

export RESTIC_REPOSITORY="${repository}"
export RESTIC_PASSWORD_FILE="${password_file}"
echo "▶ Sauvegarde chiffrée PostgreSQL vers le dépôt restic configuré…"
docker compose exec -T db sh -ceu \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' |
  restic backup --stdin --stdin-filename aiduca-postgres.dump \
    --tag aiduca --tag postgres

restic check --read-data-subset="${RESTIC_CHECK_SUBSET:-1/20}"
echo "✅ Sauvegarde hors site créée et contrôle restic terminé."
