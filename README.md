# KanaDrill

Application web pour réviser le japonais un peu chaque jour : d'abord les kana, puis les kanjis, en répétition espacée. Comptes via Discord, progression propre à chaque utilisateur.

> Contexte, décisions et feuille de route : [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md).

**Stack** : Nx · NestJS + TypeORM + PostgreSQL · Angular + Tailwind CSS · Docker Compose.

```
apps/api       API NestJS (auth Discord, profil, migrations)
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

Le scope demandé est `identify` uniquement (pseudo + avatar, pas d'e-mail).

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
# Tests d'intégration (auth avec Discord simulé, schéma d'apprentissage et seed), sur une vraie base.
# ATTENTION : ils vident les tables `users` et `items` de la base indiquée.
# Les kana sont chargés automatiquement au démarrage de l'API (aucune commande de seed).
TEST_DATABASE_URL=postgres://kanadrill:devpass@127.0.0.1:5432/kanadrill_test npx nx test api
```

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

### Sauvegarde de la base

```bash
docker compose exec db pg_dump -U kanadrill kanadrill > kanadrill-$(date +%F).sql
```

## Sécurité : à savoir

- Session = JWT dans un cookie httpOnly valable 30 jours, **non révocable pour l'instant** (une table de tokens est prévue, voir la feuille de route).
- L'inscription est libre : toute personne ayant un compte Discord peut créer un compte. Les requêtes sont limitées par IP (100/min en général, 20/min sur l'authentification).
