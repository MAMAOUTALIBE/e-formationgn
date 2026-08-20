#!/usr/bin/env bash
# Exercice de restauration dans une base isolée. Aucun accès à la base de
# production n'est accepté comme cible. Le mode par défaut est non mutatif.
set -euo pipefail

mode="${1:---dry-run}"
compose_dir="${COMPOSE_DIR:-/docker/e-formationgn}"
target_db="${RESTORE_DRILL_DB:-aiduca_restore_drill}"
password_file="${RESTIC_PASSWORD_FILE:-}"

case "${target_db}" in
  *_restore_drill) ;;
  *) echo "❌ RESTORE_DRILL_DB doit se terminer par _restore_drill." >&2; exit 1 ;;
esac
if ! printf '%s' "${target_db}" | grep -Eq '^[A-Za-z0-9_]+_restore_drill$'; then
  echo "❌ RESTORE_DRILL_DB contient des caractères non autorisés." >&2
  exit 1
fi

case "${mode}" in
  --dry-run)
    echo "DRY-RUN: restaure le dernier aiduca-postgres.dump dans ${target_db}."
    echo "DRY-RUN: aucune base n'est créée ou supprimée."
    echo "DRY-RUN: --execute exige RESTORE_DRILL_CONFIRM=CREATE_ISOLATED_DATABASE."
    exit 0
    ;;
  --execute)
    [ "${RESTORE_DRILL_CONFIRM:-}" = "CREATE_ISOLATED_DATABASE" ] || {
      echo "❌ Confirmation explicite absente." >&2
      exit 1
    }
    ;;
  *) echo "Usage: $0 [--dry-run|--execute]" >&2; exit 2 ;;
esac

[ -d "${compose_dir}" ] || { echo "❌ COMPOSE_DIR introuvable." >&2; exit 1; }
[ -n "${RESTIC_REPOSITORY:-}" ] || { echo "❌ RESTIC_REPOSITORY est obligatoire." >&2; exit 1; }
[ -r "${password_file}" ] || { echo "❌ RESTIC_PASSWORD_FILE doit être lisible." >&2; exit 1; }
command -v docker >/dev/null || { echo "❌ docker est introuvable." >&2; exit 1; }
command -v restic >/dev/null || { echo "❌ restic est introuvable." >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "❌ pg_restore est introuvable (installer postgresql-client)." >&2; exit 1; }

export RESTIC_PASSWORD_FILE="${password_file}"
cd "${compose_dir}"

if docker compose exec -T db sh -ceu \
  'psql -U "$POSTGRES_USER" -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '\''$1'\''"' \
  sh "${target_db}" | grep -q 1; then
  echo "❌ La base isolée ${target_db} existe déjà ; abandon sans modification." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "${tmp_dir}"' EXIT
dump_file="${tmp_dir}/aiduca-postgres.dump"

echo "▶ Téléchargement du dernier dump chiffré…"
restic dump latest aiduca-postgres.dump > "${dump_file}"
pg_restore --list "${dump_file}" >/dev/null

echo "▶ Création et restauration de la base isolée ${target_db}…"
docker compose exec -T db sh -ceu \
  'createdb -U "$POSTGRES_USER" "$1"' sh "${target_db}"
docker compose exec -T db sh -ceu \
  'exec pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges' \
  sh "${target_db}" < "${dump_file}"
docker compose exec -T db sh -ceu \
  'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -c "SELECT current_database(), count(*) AS tables FROM information_schema.tables WHERE table_schema = '\''public'\'';"' \
  sh "${target_db}"

echo "✅ Drill restauré dans ${target_db}. La base est conservée pour inspection."
echo "   Sa suppression doit être une action séparée, explicitement autorisée."
