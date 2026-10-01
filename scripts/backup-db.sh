#!/usr/bin/env bash
# Sauvegarde la base PostgreSQL du compose : un dump compressé (format « custom » de pg_dump), puis rotation.
#
#   scripts/backup-db.sh
#
# Variables facultatives :
#   BACKUP_DIR     dossier des sauvegardes (défaut : ./backups, ignoré par git)
#   KEEP           nombre de sauvegardes conservées (défaut : 14)
#   COMPOSE_FILE   fichier compose à utiliser (défaut : docker-compose.yml ; docker-compose.dev.yml en développement)
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
KEEP="${KEEP:-14}"
compose=(docker compose -f "${COMPOSE_FILE:-docker-compose.yml}")

# Les dumps contiennent des données personnelles (identifiants Discord) : lisibles par toi seul.
umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/kanadrill-$(date +%F-%H%M%S).dump"
partial="$file.partial"
trap 'rm -f "$partial"' EXIT

# Les identifiants viennent du conteneur lui-même (POSTGRES_USER / POSTGRES_DB), pas de ce script.
"${compose[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$partial"

# Un dump vide ou tronqué ne doit jamais prendre la place d'une bonne sauvegarde : on vérifie qu'il se relit.
"${compose[@]}" exec -T db pg_restore --list < "$partial" > /dev/null
mv "$partial" "$file"

# Rotation : on ne garde que les KEEP plus récentes.
ls -1t "$BACKUP_DIR"/kanadrill-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "Sauvegarde créée : $file ($(du -h "$file" | cut -f1))"
