#!/usr/bin/env bash
# Exécuté SUR LE VPS par la clé SSH de GitHub Actions (forcée via `command=` dans authorized_keys).
set -euo pipefail

APP_DIR="$HOME/stacks/kanadrill"
BACKUP_DIR="$HOME/data/dumps/kanadrill"
SHA="${SSH_ORIGINAL_COMMAND:-}"

# Seul un SHA complet est accepté : rien d'autre ne peut être injecté dans le script.
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SHA invalide : '$SHA'" >&2
  exit 1
fi

# Un seul déploiement à la fois.
exec 9>/tmp/kanadrill-deploy.lock
flock -n 9 || { echo "Un déploiement est déjà en cours." >&2; exit 1; }

cd "$APP_DIR"
git fetch --prune origin master

# On ne déploie que des commits qui font partie de l'historique de master.
if ! git merge-base --is-ancestor "$SHA" origin/master; then
  echo "Le commit $SHA n'est pas dans master." >&2
  exit 1
fi

# Sauvegarde avant de toucher à quoi que ce soit (les migrations s'appliquent au démarrage de l'API).
mkdir -p "$BACKUP_DIR"
if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo "==> Sauvegarde de la base"
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip > "$BACKUP_DIR/pre-deploy-$(date +%F-%H%M%S)-${SHA:0:7}.sql.gz"
  # On garde les 10 dernières sauvegardes.
  ls -1t "$BACKUP_DIR"/pre-deploy-*.sql.gz | tail -n +11 | xargs -r rm --
fi

echo "==> Mise à jour du code vers ${SHA:0:7}"
git reset --hard "$SHA"

echo "==> Build et redémarrage"
docker compose up -d --build --remove-orphans

echo "==> Vérification de santé"
for _ in $(seq 1 30); do
  if docker compose exec -T web wget -qO- http://127.0.0.1/api/health >/dev/null 2>&1; then
    echo "OK : application opérationnelle (${SHA:0:7})"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "ÉCHEC : l'API ne répond pas après le déploiement." >&2
docker compose ps >&2
docker compose logs --tail=60 api >&2
exit 1