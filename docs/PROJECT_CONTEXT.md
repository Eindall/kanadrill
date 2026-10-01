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
- **Pas de limite quotidienne de nouvelles cartes** (décision du propriétaire). Le fonctionnement visé :
  1. un mode **« Apprendre »** : on lit la « page » (fiche détail : lectures, sens, ordre des traits…) de chaque kana et de chaque kanji ; les kanji s'**ajoutent à son dictionnaire perso**, les kana y sont **d'office** ;
  2. des **sessions** que l'on lance autant de fois qu'on veut, **paramétrées à chaque lancement** : nombre de cartes (15 / 30 / 50), types (hiragana, katakana, kanji : cases à cocher ; un type coché = **tous** ses éléments, on ne choisit pas kana par kana), exercices (QCM, texte libre, tracé : cases à cocher, tracé **réservé au mobile**) ;
  3. un **objectif quotidien** réglable dans le profil (« je veux tenter X cartes aujourd'hui »), affiché sur l'accueil avec une jauge de remplissage en %. Seul compte le nombre de cartes **tentées** : réussites et échecs sont indifférents.
  Ce parcours sera mis en place quand les kanji arriveront (voir § 3 « Cible » et § 5).

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
| Données de base | **Seed idempotent au démarrage de l'API** (upsert), pas une migration | Une migration ne se rejoue pas : corriger une lecture ou ajouter un jeu de caractères aurait imposé une nouvelle migration. Aucune commande manuelle. |
| Répétition espacée | **FSRS** (lib `ts-fsrs`) | Plus efficace que SM-2 (moins de révisions pour une même rétention), calibrable par utilisateur grâce aux `ReviewLog`. |
| Kanjis | Import **local** de KANJIDIC2 (lectures, sens, niveau JLPT, traits) + **KanjiVG** (ordre des traits) | Pas de dépendance à une API externe susceptible de tomber. Licences CC BY-SA : prévoir une mention dans l'app. |
| Exercices | QCM + saisie du romaji dès la v1 ; **dessin du caractère sur mobile en v2** | Reconnaissance automatique du tracé = gros chantier ; v2 = canvas + modèle KanjiVG + auto-évaluation. |
| Nouvelles cartes | **Pas de limite quotidienne** ; c'est le **dictionnaire perso** qui joue ce rôle pour les kanji (une carte n'entre en révision que si l'utilisateur l'a ajoutée). **Les kana sont d'office dans le dictionnaire** : cocher « hiragana » = tous les hiragana, sinon aucun | Choix du propriétaire. Écarté : limite de N nouvelles cartes par jour (implémentée à l'étape 4 comme solution **transitoire**, à retirer, voir § 3). |
| Sessions | **Paramétrées à chaque lancement** (nombre de cartes, types, exercices), illimitées en nombre. Si la sélection ne contient pas assez de cartes, on **cycle** celles qui existent pour atteindre le nombre demandé | Remplace le choix automatique du mode selon l'état de la carte (QCM pour les nouvelles, saisie pour les cartes en révision). |
| Objectif quotidien | Réglage **par utilisateur** dans le profil (nombre de cartes à tenter par jour), jauge en % sur l'accueil. Compte les **réponses données** aujourd'hui, **réussies ou non** | C'est un objectif de motivation, **pas une limite** : on peut le dépasser et lancer d'autres sessions. Une session de 30 cartes valide un objectif de 30, quel que soit le résultat. |
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

### Modèle d'apprentissage (implémenté, `apps/api/src/app/learning`)

- `Item` : un élément à apprendre (`type` : hiragana | katakana | kanji, caractère, `readings` = romaji acceptés dont le premier est la référence, `meanings`, `metadata` jsonb). Unique par (type, caractère).
- `UserItem` : l'état FSRS d'un item pour un utilisateur, colonne par colonne comme le `Card` de ts-fsrs (`toCard()` / `applyCard()` dans `fsrs-card.ts`). Unique par (utilisateur, item), index (utilisateur, échéance).
- `ReviewLog` : chaque réponse (note 1-4, durée en ms, date) + snapshot FSRS de la carte **avant** la réponse (requis par l'optimiseur de paramètres).
- Les valeurs de `Rating` / `State` sont recopiées dans `libs/shared` (`REVIEW_RATING`, `CARD_STATE`) ; un test vérifie qu'elles restent égales à celles de ts-fsrs.
- **Seed** : `SeedService` (`OnApplicationBootstrap`) fait un upsert idempotent des kana à chaque démarrage, après les migrations. Données dans `learning/seed/kana.data.ts` (hiragana + lectures ; le katakana en est dérivé par décalage Unicode). 104 kana par écriture : base 46 (ん et を inclus) + dakuten/handakuten 25 + yōon 33. Hors périmètre : kana rares (ゐ ゑ ヴ) et extensions katakana (ファ…). Corriger une lecture = modifier le fichier de données, pas de migration.

### Session de révision (implémentée, `learning/reviews.*`) — version transitoire

> Cette version (limite quotidienne, mode imposé par l'état de la carte, tous les kana d'office) est une **étape intermédiaire** : elle sera remplacée par le modèle décrit dans « Cible » ci-dessous. Ce qui reste valable : correction du romaji, notation, FSRS, `ReviewLog`, file côté front, bilan.

- `GET /api/reviews/session` : cartes **dues** (`state != New`, `due <= now`, les plus anciennes d'abord, 100 max), puis **nouvelles cartes** (items sans `UserItem`, par `items.sort_order`) dans la limite `users.daily_new_limit` (défaut 10, 0–100, modifiable via `PATCH /users/me { dailyNewLimit }`) moins les nouvelles cartes déjà vues aujourd'hui (`review_logs.state = New` depuis minuit). Le « jour » suit `APP_TIMEZONE` (défaut `Europe/Paris`). Le GET n'écrit rien : le `UserItem` est créé à la première réponse.
- Mode : QCM (4 propositions, leurres = autres items du même type, jamais une réponse aussi valable comme « o » pour お/を) pour les cartes New/Learning/Relearning ; saisie du romaji pour les cartes en Review.
- `POST /api/reviews { itemId, mode, answer, durationMs }` : le **serveur corrige** (`isRomajiCorrect`), déduit la note (`grading.ts`), puis, en une transaction, verrouille/crée le `UserItem`, écrit le `ReviewLog` (snapshot avant réponse) et applique FSRS (`enable_fuzz`). Notes : faux → Again ; juste → Good ; juste et > 8 s → Hard ; juste, **saisie** et < 2,5 s → Easy (jamais Easy au QCM). `durationMs` est plafonné à 120 s.
- Correction du romaji dans `libs/shared/src/lib/romaji.ts` (partagée API/front) : normalisation (casse, espaces, tirets, apostrophes) + variantes Hepburn / Nihon-shiki (shi/si, chi/ti, tsu/tu, fu/hu, ji/zi, sha/sya, cha/tya, ja/jya/zya, n/nn…). Les `readings` du seed contiennent déjà certaines variantes ; les règles complètent.
- Front (`features/review`) : une carte à la fois, grand caractère, retour immédiat calculé localement (le serveur fait foi ensuite), une carte **ratée est remise en fin de file** (`review-queue.ts`), bilan final (cartes, réussite sur première réponse, temps moyen, cartes à retravailler, prochaine échéance). Accueil : bouton « Commencer la session ».
- **Limites connues** : `POST /reviews` n'est pas idempotent (un renvoi réseau compterait deux révisions) ; une bonne réponse à une carte en apprentissage n'est pas reposée dans la session (seules les ratées le sont) ; les katakana arrivent après tous les hiragana (`sort_order`).
- Le flux a été essayé à la main avec une vraie connexion Discord (OK) ; l'API est couverte par `reviews.integration.spec.ts`.

### Cible : dictionnaire perso, sessions paramétrées, objectif quotidien (à faire avec les kanji)

Ce que cela change dans le modèle, par rapport à l'étape 4 :

- **Dictionnaire perso = tous les kana + les kanji ajoutés.** Les **kana sont d'office** dans le dictionnaire de chacun (pas de bouton d'ajout, pas de sélection kana par kana : un type coché = tous ses éléments). Les **kanji** n'y entrent que sur ajout explicite (`POST` / `DELETE` sur le dictionnaire) : l'ajout crée le `UserItem` (état `New`, `due = now`). Un kana jamais révisé reste, lui, sans `UserItem` jusqu'à sa première réponse (création paresseuse, comme aujourd'hui) : **aucun rattrapage à prévoir** quand de nouveaux kana sont ajoutés au seed, ni à la création d'un compte. Les cartes éligibles d'une session = les items des types cochés qui sont des kana, ou des kanji ayant un `UserItem`.
- **Mode « Apprendre »** : catalogue de **tous** les éléments, kana compris (grille par écriture et par groupe : base, dakuten, yōon…), avec une **fiche détail** par élément : caractère, lectures (on/kun pour un kanji), sens, niveau JLPT, **ordre des traits animé** (KanjiVG, qui couvre aussi les kana). Sur une fiche kanji : bouton « Ajouter à mon dictionnaire » (ou retirer). Sur une fiche kana : pas de bouton, le kana y est déjà. Pour les kanji, l'ajout par caractère remplit tout seul la page (KANJIDIC2).
- **Session paramétrée** : écran de réglage (15 / 30 / 50 cartes, cases hiragana / katakana / kanji, cases QCM / texte libre / tracé) puis lancement. La requête de session porte ces paramètres (`count`, `types[]`, `modes[]`) ; le serveur compose la liste de `count` cartes (cartes dues d'abord, puis cartes jamais vues, puis **cycle** des cartes de la sélection, voir plus bas) et attribue à chaque carte l'un des modes cochés. Le **tracé** n'est proposé que sur appareil tactile et seulement pour les items qui ont des données de traits (KanjiVG couvre aussi les kana).
- **Objectif quotidien** : `users.daily_goal` (nombre de cartes à tenter par jour) remplace `users.daily_new_limit`. L'accueil affiche `réponses d'aujourd'hui / objectif` en pourcentage, plafonné à 100 % à l'affichage (jour calculé avec `APP_TIMEZONE`, comme aujourd'hui). On compte les **lignes de `review_logs`** du jour, **réussies ou non** ; une session abandonnée compte ce qui a été répondu ; une carte ratée puis reposée dans la session compte à chaque réponse (la session de 30 cartes valide donc bien un objectif de 30, quitte à le dépasser un peu). L'objectif n'empêche rien.
- **Cycle quand la sélection est trop petite** (ex. 30 cartes demandées, 12 disponibles) : c'est possible. Le serveur complète en repassant sur les cartes de la sélection, la moins récemment vue d'abord, en tours successifs, sans jamais poser deux fois de suite la même carte (sauf s'il n'y en a qu'une). Ces cartes de complément sont traitées **comme n'importe quelle réponse** : elles comptent pour l'objectif, apparaissent dans le bilan, **mettent à jour la carte FSRS** et écrivent un `ReviewLog` normal (pas de colonne ni d'indicateur « entraînement »). Décision du propriétaire : perdre un peu en précision de planification (cartes revues avant leur échéance ou à quelques minutes d'écart) est acceptable ; ts-fsrs gère les révisions anticipées. Si la sélection est **vide** (ex. seulement « kanji » coché avec un dictionnaire sans kanji), le lancement est refusé avec un message, et l'écran de réglage indique le nombre de cartes disponibles par type.
- À retirer le moment venu : `users.daily_new_limit` (colonne, `PATCH /users/me { dailyNewLimit }`, constantes `DEFAULT_DAILY_NEW_LIMIT` / `MAX_DAILY_NEW_LIMIT`), le calcul « nouvelles cartes déjà vues aujourd'hui », et le choix du mode selon l'état de la carte. `items.sort_order` peut rester pour ordonner les listes du mode « Apprendre ».

Aucune question ouverte pour ce parcours : prêt à être découpé en étapes.

## 4. État actuel

Fait et vérifié (contre un vrai PostgreSQL, avec un Discord simulé) :
- Monorepo, Docker Compose, config nginx.
- Connexion Discord via Passport (state anti-CSRF en cookie, retour sur `/login?error=…` en cas d'échec ou de refus), session cookie, `GET/PATCH/DELETE /api/users/me`, suppression du compte en cascade, `GET /api/health`.
- Front : connexion, accueil vide, profil (pseudo, connexions liées, déconnexion, suppression du compte).
- Test d'intégration de l'authentification (`auth.integration.spec.ts`, voir README).
- Étape 3 : entités `Item` / `UserItem` / `ReviewLog`, migration `LearningSchema`, seed automatique des kana, test d'intégration `learning.integration.spec.ts` (bundle de production démarré sur base vierge : OK).

- Étape 4 : session de révision quotidienne (API + écran mobile, voir § 3) ; tests de la correction du romaji, de la notation, des QCM, de la file côté front, et test d'intégration `reviews.integration.spec.ts`.

**Non vérifié** : le flux OAuth avec une vraie application Discord, le `docker compose build` réel (aucun Docker disponible lors de la création ; les étapes ont été rejouées à la main), l'affichage des avatars Discord.

## 5. Feuille de route

1. ~~Monorepo, Docker, auth Discord, profil~~ (fait).
2. **Table de tokens de session** (demandée par le propriétaire « par sécurité ») : stocker chaque session (id/`jti`, utilisateur, empreinte, expiration, révocation, dernière utilisation), faire valider le JWT contre cette table dans `JwtAuthGuard`, permettre la déconnexion réelle et la révocation. Prévoir aussi le nettoyage des sessions expirées.
3. ~~Schéma `Item` / `UserItem` / `ReviewLog` + données de base hiragana et katakana~~ (fait).
4. ~~Exercices QCM et saisie du romaji, avec FSRS branché dès le début ; écran de session quotidienne~~ (fait, version transitoire avec limite quotidienne). Reste à envisager : idempotence du POST.
5. Statistiques, installation PWA (manifest, service worker).
6. Kanjis et nouveau parcours (voir § 3 « Cible ») : import KANJIDIC2 + ajout par caractère ; ordre des traits (KanjiVG) ; **dictionnaire perso** (kanji) et mode « Apprendre » avec **fiches détail kana et kanji** (ordre des traits) ; **sessions paramétrées** (nombre de cartes, types, exercices) ; **objectif quotidien** dans le profil + jauge sur l'accueil ; suppression de la limite quotidienne de l'étape 4. Découpage possible : d'abord sessions paramétrées (types hiragana / katakana, QCM / texte libre, cycle) + objectif quotidien (déjà utilisables avec les kana), puis KanjiVG et les fiches détail (kana puis kanji), puis dictionnaire et kanji.
7. Exercice de **tracé** sur mobile (canvas + auto-évaluation, option « tracé » des sessions, tactile uniquement), puis éventuelle vérification automatique.
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
- **CLI TypeORM** : `migration:generate` ne résout pas `@kanadrill/shared` à l'exécution. Les entités n'importent que des **types** depuis `libs/shared` (pas de constante) ; sinon « Cannot find module '@kanadrill/shared' ».
- **UUID** : générés par `pgcrypto` (`gen_random_uuid`, natif depuis Postgres 13), aucune extension à installer.
- **Formulaires Angular** : un `<form>` avec seulement `ReactiveFormsModule` se soumet nativement (rechargement de page) ; utiliser `(submit)` + `preventDefault()` ou importer `FormsModule`.
- **IP réelle** : nginx (conteneur web) ne fait confiance à `X-Forwarded-For` que depuis les réseaux privés ; l'API a `trust proxy = 1`. Si un CDN (ex. Cloudflare en mode proxy) est placé devant, adapter la config pour que la limitation de débit voie la vraie IP.
- **Tests d'intégration** : ils partagent une même base (`TRUNCATE users`, migrations). Jest tourne avec `maxWorkers: 1` pour l'API (`jest.config.cts`) ; en parallèle, le test d'auth échouait au hasard. Si le flux de profil Discord change (`DiscordStrategy.userProfile`), adapter la simulation dans `auth.integration.spec.ts`.
