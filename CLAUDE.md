# KanaDrill

Application web de révision du japonais (kana puis kanjis, répétition espacée). Monorepo Nx : NestJS + TypeORM + PostgreSQL (`apps/api`), Angular + Tailwind (`apps/web`), types partagés (`libs/shared`).

**Lis d'abord @docs/PROJECT_CONTEXT.md** : besoin, décisions (et alternatives écartées), état d'avancement, feuille de route, conventions et pièges connus.

## Commandes utiles

- `npm run db:up` : PostgreSQL de dev (Docker). Config locale dans `.env` (voir `.env.example`, section développement).
- `npm run dev:api` / `npm run dev:web` : API (port 3000) et front (port 4200, proxy `/api`).
- `npm run test` ; tests d'intégration : `TEST_DATABASE_URL=postgres://…/kanadrill_test npx nx test api` (vident `users` de cette base ; le nom de la base **doit contenir « test »**, sinon les tests refusent de démarrer). Sans cette variable ils sont ignorés.
- `npm run migration:generate -- apps/api/src/app/database/migrations/Nom` puis **ajouter la migration à `MIGRATIONS`** (`database/migrations/index.ts`).
- Production : `docker compose up -d --build` (voir README).

## Règles

- Interface et documentation en français. Pas de `synchronize` TypeORM. Aucun secret dans le dépôt.
- Les types partagés front/back vont dans `libs/shared`.
- Ne pas mettre à jour `@nestjs/*` vers la v12 (ESM-only, incompatible avec Nest 11) sans migrer tout Nest.
- Quand une décision change ou qu'une étape de la feuille de route est terminée, mets à jour `docs/PROJECT_CONTEXT.md`.
