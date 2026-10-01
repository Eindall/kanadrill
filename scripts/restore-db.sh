#!/usr/bin/env bash
# Restaure une sauvegarde faite par backup-db.sh. REMPLACE les données de la base cible.
#
#   scripts/restore-db.sh backups/kanadrill-2026-10-01-030000.dump
#
# Variables facultatives :
#   COMPOSE_FILE   fichier compose à utiliser (défaut : docker-compose.yml)
#   TARGET_DB      base à restaurer (défaut : POSTGRES_DB du conteneur) ; elle doit déjà exister
#   ASSUME_YES=1   ne pas demander de confirmation
set -euo pipefail

cd "$(dirname "$0")/.."
file="${1:?Usage : scripts/restore-db.sh fichier.dump}"
[ -f "$file" ] || { echo "Fichier introuvable : $file" >&2; exit 1; }
compose=(docker compose -f "${COMPOSE_FILE:-docker-compose.yml}")

target="${TARGET_DB:-$("${compose[@]}" exec -T db sh -c 'printf %s "$POSTGRES_DB"')}"
if [ "${ASSUME_YES:-}" != "1" ]; then
  read -r -p "Ceci REMPLACE toutes les données de la base « $target » par $file. Continuer ? [oui/N] " answer
  [ "$answer" = "oui" ] || { echo "Annulé."; exit 1; }
fi

# L'API est arrêtée pendant la restauration (sinon des connexions ouvertes bloqueraient le DROP des tables).
api_was_running=0
if [ -n "$("${compose[@]}" ps --status running --services 2>/dev/null | grep -x api || true)" ]; then
  api_was_running=1
  "${compose[@]}" stop api
fi

# --clean --if-exists : supprime d'abord les objets existants ; --single-transaction : tout ou rien.
"${compose[@]}" exec -T db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d '$target' --clean --if-exists --no-owner --single-transaction" < "$file"

if [ "$api_was_running" = "1" ]; then
  "${compose[@]}" start api
fi
echo "Base « $target » restaurée depuis $file"
