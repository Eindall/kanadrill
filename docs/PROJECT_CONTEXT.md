# KanaDrill — contexte du projet

> Ce fichier est la référence à lire en premier pour reprendre le projet (humain, Cursor, Claude Code…).
> Il résume le besoin, les décisions prises (et celles écartées), l'état actuel et la suite.
> **Mets-le à jour** quand une décision change : il doit rester la source de vérité.

## 1. Le besoin

- Le propriétaire du projet apprend le japonais en cours (1 séance par semaine, organisme de formation). Son prof a fixé **un mois pour maîtriser les hiragana** : ensuite, les cours se feront sans romaji, uniquement en kana puis kanjis au fil de l'eau.
- Il a déjà des bases assez avancées et veut **réviser un peu chaque jour** : d'abord les kana (hiragana puis katakana), puis des **kanjis ajoutés au fur et à mesure** de ce qu'il apprend en cours.
- Application web **perso, dockerisée, auto-hébergée sur un VPS**, avec une base de données pour **enregistrer les résultats**.
- **Mobile friendly** (usage quotidien sur téléphone).
- **Multi-utilisateurs** : quelques amis qui parlent japonais pourront s'inscrire librement, chacun avec ses propres kanjis et sa propre progression.
- Les kanjis doivent pouvoir s'ajouter **automatiquement** (on saisit le caractère, les lectures et le sens se remplissent seuls).

## 2. Décisions prises

| Sujet | Décision | Pourquoi / alternatives écartées |
|---|---|---|
| Structure | Monorepo **Nx** : `apps/api`, `apps/web`, `libs/shared` | Types partagés front/back (DTO, règles de validation du pseudo). |
| Back | **NestJS 11** + **TypeORM 1.x** + **PostgreSQL 16** | TypeORM choisi (Prisma recommandé au départ, écarté) : le propriétaire veut se former dessus. Postgres plutôt que SQLite : multi-utilisateurs, écritures concurrentes. |
| Front | **Angular 22** (composants standalone, signals) + **Tailwind CSS 4** | Tailwind imposé par le propriétaire. |
| Mobile | **PWA** responsive, mobile d'abord | Une vraie app native est inutile ici. |
| Authentification | **OAuth Discord uniquement**, via **Passport** (`passport-oauth2`), scope `identify` | Écartés : pseudo + mot de passe (pas de SMTP pour réinitialiser), liens d'invitation, Google. Discord = pas d'e-mail stocké, filtre naturel contre les bots, et un futur **bot Discord** pourra retrouver le compte via l'ID Discord. |
| Inscription | **Libre** (premier login Discord = création du compte) | Choix du propriétaire. Limitation de débit côté API pour compenser. |
| Session | **JWT signé dans un cookie httpOnly** (30 jours), sans stockage serveur | Suffisant « dans un premier temps ». **À faire** : table de tokens pour pouvoir révoquer (voir §5). |
| Répétition espacée | **FSRS** (lib `ts-fsrs`) | Plus efficace que SM-2 (moins de révisions pour une même rétention), calibrable par utilisateur grâce aux `ReviewLog`. |
| Kanjis | Import **local** de KANJIDIC2 (lectures, sens, niveau JLPT, traits) + **KanjiVG** (ordre des traits) | Pas de dépendance à une API externe susceptible de tomber. Licences CC BY-SA : prévoir une mention dans l'app. |
| Exercices | QCM + saisie du romaji dès la v1 ; **dessin du caractère sur mobile en v2** | Reconnaissance automatique du tracé = gros chantier ; v2 = canvas + modèle KanjiVG + auto-évaluation. |
| Déploiement | `docker compose` (db + api + web/nginx), à placer **derrière le reverse proxy du VPS** | Seul le conteneur `web` est exposé, sur 127.0.0.1. |

## 3. Architecture

```
apps/api            NestJS : auth Discord (Passport), session JWT, profil, santé, migrations TypeORM
  src/app/auth        stratégie + guard Discord, session (cookie JWT), guard JWT
  src/app/users       entités User / AuthIdentity, service, contrôleur /users/me
  src/app/database    DataSource (CLI TypeORM), liste des entités, liste des migrations
apps/web            Angular + Tailwind : pages login, accueil, profil ; proxy dev vers l'API
libs/shared         Types et constantes partagés (UserDto, règles du pseudo, fournisseurs OAuth)
```

- Le navigateur ne parle qu'à **une seule origine** : nginx (prod) ou le proxy du dev-server Angular (`/api` → `localhost:3000`). Pas de CORS, cookies simples.
- `User` (pseudo modifiable, avatar) ←1—n→ `AuthIdentity` (`provider`, `providerId` unique ensemble). Une identité = un compte chez un fournisseur ; plusieurs fournisseurs pourront être ajoutés plus tard sans toucher à `User`.
- Les migrations sont **appliquées au démarrage de l'API** (`migrationsRun: true`) ; `synchronize` est désactivé.

### Modèle de données prévu (pas encore implémenté)

- `Item` : un élément à apprendre (`type` : hiragana | katakana | kanji | …, caractère, lectures, sens, métadonnées).
- `UserItem` : l'état FSRS d'un item pour un utilisateur (échéance, stabilité, difficulté, état, nombre de ratés) — unique par (utilisateur, item).
- `ReviewLog` : chaque réponse (item, note Again/Hard/Good/Easy, durée, date), pour les stats et l'optimisation FSRS.

## 4. État actuel

Fait et vérifié (contre un vrai PostgreSQL, avec un Discord simulé) :
- Monorepo, Docker Compose, config nginx.
- Connexion Discord via Passport (state anti-CSRF en cookie, retour sur `/login?error=…` en cas d'échec ou de refus), session cookie, `GET/PATCH/DELETE /api/users/me`, suppression du compte en cascade, `GET /api/health`.
- Front : connexion, accueil vide, profil (pseudo, connexions liées, déconnexion, suppression du compte).
- Test d'intégration de l'authentification (`auth.integration.spec.ts`, voir README).

**Non vérifié** : le flux OAuth avec une vraie application Discord, le `docker compose build` réel (aucun Docker disponible lors de la création ; les étapes ont été rejouées à la main), l'affichage des avatars Discord.

## 5. Feuille de route

1. ~~Monorepo, Docker, auth Discord, profil~~ (fait).
2. **Table de tokens de session** (demandée par le propriétaire « par sécurité ») : stocker chaque session (id/`jti`, utilisateur, empreinte, expiration, révocation, dernière utilisation), faire valider le JWT contre cette table dans `JwtAuthGuard`, permettre la déconnexion réelle et la révocation. Prévoir aussi le nettoyage des sessions expirées.
3. Schéma `Item` / `UserItem` / `ReviewLog` + données de base hiragana et katakana.
4. Exercices QCM et saisie du romaji, avec FSRS branché dès le début ; écran de session quotidienne.
5. Statistiques, installation PWA (manifest, service worker).
6. Kanjis : import KANJIDIC2, ajout par caractère, listes personnelles par utilisateur, ordre des traits (KanjiVG).
7. Dessin du caractère sur mobile (canvas + auto-évaluation), puis éventuelle vérification automatique.
8. Idée : bot Discord (rappels de révision en DM, commandes slash) ; mention des licences KANJIDIC2 / KanjiVG dans l'app.

## 6. Conventions

- Identifiants du code en **anglais** (les commentaires peuvent être en français) ; textes de l'interface, messages d'erreur et documentation en **français**.
- TypeScript strict côté web ; les types qui traversent la frontière API ↔ web vivent dans `libs/shared` (import `@kanadrill/shared`).
- API : validation par `class-validator` (`ValidationPipe` global, `whitelist` + `forbidNonWhitelisted`). Les routes protégées utilisent `@UseGuards(JwtAuthGuard)` et `@CurrentUserId()`.
- Migrations : **jamais** de `synchronize`. Après `npm run migration:generate -- apps/api/src/app/database/migrations/NomDeLaMigration`, **ajouter la classe générée à `MIGRATIONS`** dans `database/migrations/index.ts` (liste explicite : le bundle webpack n'a pas de glob de fichiers). Pareil pour toute nouvelle entité dans `database/entities.ts`.
- Front : composants standalone, signals, nouvelle syntaxe de template (`@if`, `@for`), Tailwind avec les couleurs de `styles.css` (`ink`, `paper`, `snow`, `line`, `seal`) et la police `font-kana` pour le japonais. Le rouge `seal` est réservé aux actions importantes et aux erreurs. Mobile d'abord, focus visible, `prefers-reduced-motion` respecté.
- Aucun secret dans le dépôt : tout passe par `.env` (ignoré par git).

## 7. Pièges déjà rencontrés (ne pas les redécouvrir)

- **Versions ESM-only** : `@nestjs/config` 12, `@nestjs/typeorm` 12, `@nestjs/jwt` 12 et `@nestjs/passport` 12 ciblent Nest 12 et cassent Jest/webpack en CJS. Rester sur `@nestjs/config` ^4, `@nestjs/typeorm` ^11, `@nestjs/jwt` ^11, `@nestjs/passport` ^11 tant que Nest reste en 11.
- **`.npmrc` avec `legacy-peer-deps=true`** : sans lui, `npm install` échoue sur les dépendances croisées d'Angular 22 / Nx.
- **Driver `pg`** : TypeORM le charge dynamiquement, Nx ne le détecte pas. L'`import 'pg'` dans `app.module.ts` est volontaire (sinon le conteneur de prod plante au démarrage).
- **Image API** : on n'utilise pas le `package-lock.json` généré par Nx (désynchronisé de son `package.json`, `npm ci` échoue) ; le Dockerfile fait un `npm install` sur le `package.json` épinglé.
- **Passport sans session** : `passport-oauth2` ne gère le `state` qu'avec une session serveur. Le `state` est donc géré par `DiscordAuthGuard` (cookie). Sans `code` dans le callback (utilisateur qui refuse chez Discord), la lib relancerait le flux en boucle : le guard l'intercepte.
- **UUID** : générés par `pgcrypto` (`gen_random_uuid`, natif depuis Postgres 13), aucune extension à installer.
- **Formulaires Angular** : un `<form>` avec seulement `ReactiveFormsModule` se soumet nativement (rechargement de page) ; utiliser `(submit)` + `preventDefault()` ou importer `FormsModule`.
- **IP réelle** : nginx (conteneur web) ne fait confiance à `X-Forwarded-For` que depuis les réseaux privés ; l'API a `trust proxy = 1`. Si un CDN (ex. Cloudflare en mode proxy) est placé devant, adapter la config pour que la limitation de débit voie la vraie IP.
