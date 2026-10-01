# KanaDrill — instructions pour les agents (Cursor, Codex, etc.)

Application web de révision du japonais (kana puis kanjis, répétition espacée). Monorepo Nx : NestJS + TypeORM + PostgreSQL (`apps/api`), Angular + Tailwind (`apps/web`), types partagés (`libs/shared`).

**Avant toute modification, lis `docs/PROJECT_CONTEXT.md`** : besoin, décisions prises (et alternatives écartées), état d'avancement, feuille de route, conventions et pièges déjà rencontrés.

## Commandes

- `npm run db:up` : PostgreSQL de dev. Configuration locale dans `.env` (voir `.env.example`, section développement).
- `npm run dev:api` / `npm run dev:web` : API (3000) et front (4200, proxy `/api`).
- `npm run test` ; test d'intégration auth : `TEST_DATABASE_URL=... npx nx test api` (vide la table `users` de cette base).
- `npm run migration:generate -- apps/api/src/app/database/migrations/Nom`, puis **ajouter la migration à `MIGRATIONS`** dans `database/migrations/index.ts` (et toute nouvelle entité à `database/entities.ts`).
- Production : `docker compose up -d --build`.

## Règles

- Interface, messages d'erreur et documentation en français ; code en anglais.
- Jamais de `synchronize` TypeORM. Aucun secret dans le dépôt (`.env` est ignoré par git).
- Types partagés front/back dans `libs/shared` (`@kanadrill/shared`).
- Angular : composants standalone, signals, syntaxe `@if` / `@for`, Tailwind avec les couleurs du thème (`ink`, `paper`, `snow`, `line`, `seal`), mobile d'abord.
- Rester sur `@nestjs/config` ^4, `@nestjs/typeorm` ^11, `@nestjs/jwt` ^11, `@nestjs/passport` ^11 (les v12 sont ESM-only et incompatibles avec Nest 11).
- Mettre à jour `docs/PROJECT_CONTEXT.md` quand une décision change ou qu'une étape est terminée.
