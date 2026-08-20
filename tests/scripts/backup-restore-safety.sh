#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/../.." && pwd)"

backup_output="$(bash "${root_dir}/scripts/backup-offsite.sh" --dry-run)"
restore_output="$(bash "${root_dir}/scripts/restore-drill.sh" --dry-run)"

grep -q "aucun dump local persistant" <<<"${backup_output}"
grep -q "aucune base n'est créée ou supprimée" <<<"${restore_output}"

for local_repository in /var/backups/aiduca ./backups local:/backups; do
  if RESTIC_REPOSITORY="${local_repository}" \
    bash "${root_dir}/scripts/backup-offsite.sh" --dry-run >/dev/null 2>&1; then
    echo "Un dépôt restic local aurait dû être refusé : ${local_repository}" >&2
    exit 1
  fi
done

for remote_repository in \
  s3:https://storage.invalid/bucket \
  sftp:backup@example.invalid:/aiduca \
  rclone:remote:aiduca \
  rest:https://backup.invalid/aiduca; do
  RESTIC_REPOSITORY="${remote_repository}" \
    bash "${root_dir}/scripts/backup-offsite.sh" --dry-run >/dev/null
done

if RESTORE_DRILL_DB=postgres bash "${root_dir}/scripts/restore-drill.sh" --dry-run >/dev/null 2>&1; then
  echo "Une cible de restauration non isolée aurait dû être refusée." >&2
  exit 1
fi

if RESTORE_DRILL_CONFIRM=incorrect \
  bash "${root_dir}/scripts/restore-drill.sh" --execute >/dev/null 2>&1; then
  echo "Une restauration sans confirmation aurait dû être refusée." >&2
  exit 1
fi

grep -q -- '--dry-run' "${root_dir}/scripts/backup-offsite.sh"
grep -q -- 'rest:https://' "${root_dir}/scripts/backup-offsite.sh"
grep -q -- 'RESTORE_DRILL_CONFIRM=CREATE_ISOLATED_DATABASE' \
  "${root_dir}/scripts/restore-drill.sh"

echo "backup-restore-safety: PASS"
