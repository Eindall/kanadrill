# KanaDrill

Application web pour réviser le japonais un peu chaque jour : d'abord les kana, puis les kanjis, en répétition espacée. Comptes via Discord ou Google, progression propre à chaque utilisateur.

> Contexte, décisions et feuille de route : [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).

**Stack** : Nx · NestJS + TypeORM + PostgreSQL · Angular + Tailwind CSS · Docker Compose.

```
apps/api       API NestJS (auth Discord et Google, profil, migrations)
apps/web       Front Angular (PWA à venir)
libs/shared    Types partagés front/back
```

## Prérequis

Node.js 22, npm, Docker (avec Compose).

## 1. Créer l'application Discord

1. Va sur <https://discord.com/developers/applications> → **New Application**.
2. Onglet **OAuth2** : note le **Client ID**, génère le **Client Secret**.
3. Dans **OAuth2 → Redirects**, ajoute l'URL de retour :
   - développement : `http://localhost:4200/api/auth/discord/callback`
   - production : `https://ton-domaine/api/auth/discord/callback`

Les scopes demandés sont `identify` et `email` : l'e-mail n'est **jamais stocké**, il sert uniquement à calculer une empreinte (HMAC) qui détecte qu'une même personne se connecte avec Discord puis avec Google.

## 1 bis. Créer l'application Google

1. <https://console.cloud.google.com/> → **API et services → Écran de consentement OAuth** (type externe), puis **Identifiants → Créer des identifiants → ID client OAuth** (application Web).
2. **URI de redirection autorisés** :
   - développement : `http://localhost:4200/api/auth/google/callback`
   - production : `https://ton-domaine/api/auth/google/callback`
3. Renseigne `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, et `EMAIL_HASH_KEY` (`openssl rand -hex 32`, différente de `JWT_SECRET`) dans `.env`.

## 2. Développement

```bash
npm install
npm run db:up                 # PostgreSQL local (Docker)
cp .env.example .env          # puis remplace le contenu par la section « Développement local »
npm run dev:api               # API sur http://localhost:3000/api
npm run dev:web               # front sur http://localhost:4200 (proxy /api → :3000)
```

Ouvre <http://localhost:4200> (et non le port 3000) : le cookie de session et le retour OAuth passent par le proxy du front.

Les migrations sont appliquées automatiquement au démarrage de l'API.

### Base de données (TypeORM)

```bash
# Après avoir modifié une entité :
npm run migration:generate -- apps/api/src/app/database/migrations/NomDeLaMigration
# Puis ajoute la classe générée à MIGRATIONS dans apps/api/src/app/database/migrations/index.ts
# (et toute nouvelle entité à apps/api/src/app/database/entities.ts).

npm run migration:run         # appliquer à la main (l'API le fait déjà au démarrage)
npm run migration:revert      # annuler la dernière
```

### Tests

```bash
npm run test
# Tests d'intégration (auth avec Discord simulé, sessions, apprentissage, révisions), sur une vraie base.
# ATTENTION : ils vident la table `users` de la base indiquée. Son nom doit contenir « test » (sinon les tests
# refusent de démarrer) et ce ne doit JAMAIS être ta base de dev. À créer une fois :
docker compose -f docker-compose.dev.yml exec db createdb -U kanadrill kanadrill_test
TEST_DATABASE_URL=postgres://kanadrill:devpass@127.0.0.1:5432/kanadrill_test npx nx test api
```

Sans `TEST_DATABASE_URL`, les tests d'intégration sont simplement ignorés. Les kana sont chargés automatiquement au démarrage de l'API (aucune commande de seed).

## 3. Production (VPS)

```bash
cp .env.example .env          # remplis la section « Production »
docker compose up -d --build
```

- Trois conteneurs : `db` (PostgreSQL, volume persistant), `api` (NestJS), `web` (nginx : front + proxy `/api`).
- Seul `web` est exposé, sur `127.0.0.1:8080` (changeable avec `WEB_PORT`). Place ton **reverse proxy** devant (TLS, nom de domaine) en le faisant pointer sur ce port, avec les en-têtes `X-Forwarded-For` et `X-Forwarded-Proto`.
- `APP_URL` doit être l'URL publique exacte (https, sans slash final) : elle sert au retour OAuth et aux redirections. `COOKIE_SECURE=true` impose HTTPS.
- Mise à jour : `git pull && docker compose up -d --build`. Les migrations s'appliquent au démarrage de l'API.
- Santé : `GET /api/health` (vérifie aussi la base), utilisable avec Uptime Kuma.

### Sauvegarde et restauration de la base

```bash
scripts/backup-db.sh                       # crée backups/kanadrill-AAAA-MM-JJ-HHMMSS.dump (compressé), garde les 14 dernières
scripts/restore-db.sh backups/kanadrill-….dump   # REMPLACE les données ; arrête l'API pendant la restauration, puis la relance
```

- Le dump est vérifié (relu avec `pg_restore --list`) avant de remplacer une sauvegarde valide. Les fichiers sont lisibles par toi seul (ils contiennent des identifiants Discord) et `backups/` est ignoré par git.
- Variables : `BACKUP_DIR` (dossier), `KEEP` (nombre conservé), `COMPOSE_FILE` (par défaut `docker-compose.yml`).
- Planifier (cron, tous les jours à 3 h) : `0 3 * * * cd /chemin/vers/kanadrill && scripts/backup-db.sh >> backups/backup.log 2>&1`.
- **Une sauvegarde sur le même disque que la base ne protège pas d'une panne du VPS** : copie régulièrement `backups/` ailleurs (`rsync`, `rclone`, ou le stockage de ton hébergeur).
- Teste ta restauration une fois, avant d'en avoir besoin : crée une base vide (`createdb`), puis `TARGET_DB=ma_base_vide scripts/restore-db.sh fichier.dump`.

## Sécurité : à savoir

- Session = JWT dans un cookie httpOnly, relié à une ligne de la table `auth_sessions` : tu restes connecté tant que tu t'en sers au moins une fois toutes les **48 h** (30 jours d'affilée au maximum). La déconnexion révoque réellement la session ; le profil liste les appareils connectés et permet de les déconnecter.
- L'inscription est libre : toute personne ayant un compte Discord peut créer un compte. Les requêtes sont limitées par IP (100/min en général, 20/min sur l'authentification).
