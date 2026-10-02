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
  Sessions paramétrées et objectif quotidien sont **faits** (pour les kana) ; dictionnaire, « Apprendre » et kanji suivront (voir § 3 « Cible » et § 5).

## 2. Décisions prises

| Sujet | Décision | Pourquoi / alternatives écartées |
|---|---|---|
| Structure | Monorepo **Nx** : `apps/api`, `apps/web`, `libs/shared` | Types partagés front/back (DTO, règles de validation du pseudo). |
| Back | **NestJS 11** + **TypeORM 1.x** + **PostgreSQL 16** | TypeORM choisi (Prisma recommandé au départ, écarté) : le propriétaire veut se former dessus. Postgres plutôt que SQLite : multi-utilisateurs, écritures concurrentes. |
| Front | **Angular 22** (composants standalone, signals) + **Tailwind CSS 4** | Tailwind imposé par le propriétaire. |
| Mobile | **PWA** responsive, mobile d'abord : manifest + service worker Angular (`@angular/service-worker`) qui ne met en cache que la **coque** de l'application, jamais l'API ; pas de mode hors ligne | Une vraie app native est inutile ici. Pas de bouton « Installer » maison : on laisse le navigateur proposer l'installation (choix du propriétaire). |
| Authentification | **OAuth Discord uniquement**, via **Passport** (`passport-oauth2`), scope `identify` | Écartés : pseudo + mot de passe (pas de SMTP pour réinitialiser), liens d'invitation, Google. Discord = pas d'e-mail stocké, filtre naturel contre les bots, et un futur **bot Discord** pourra retrouver le compte via l'ID Discord. |
| Inscription | **Libre** (premier login Discord = création du compte) | Choix du propriétaire. Limitation de débit côté API pour compenser. |
| Session | **JWT signé dans un cookie httpOnly**, dont le `jti` désigne une ligne de la table `auth_sessions` (une ligne = un appareil). **Expiration glissante : 48 h sans usage**, **plafond absolu de 30 jours** (reconnexion Discord), 20 sessions actives max par compte | Choix du propriétaire (expiration glissante courte). Le JWT seul ne suffisait pas : il ne se révoquait pas, et un compte supprimé gardait un cookie « valide ». La base fait foi : déconnexion réelle, liste des appareils, révocation. Pas d'empreinte du jeton à stocker : les `jti` seuls ne permettent pas de fabriquer un cookie (il faut la signature). Écartés : jeton opaque haché (JWT conservé par continuité), rotation de jetons de rafraîchissement (disproportionné ici). |
| Données de base | **Seed idempotent au démarrage de l'API** (upsert), pas une migration | Une migration ne se rejoue pas : corriger une lecture ou ajouter un jeu de caractères aurait imposé une nouvelle migration. Aucune commande manuelle. |
| Répétition espacée | **FSRS** (lib `ts-fsrs`) | Plus efficace que SM-2 (moins de révisions pour une même rétention), calibrable par utilisateur grâce aux `ReviewLog`. |
| Kanjis | Import **local** de KANJIDIC2 (lectures, sens, niveau JLPT, traits) + **KanjiVG** (ordre des traits) | Pas de dépendance à une API externe susceptible de tomber. Licences CC BY-SA : prévoir une mention dans l'app. |
| Exercices | QCM + saisie du romaji dès la v1 ; **dessin du caractère sur mobile en v2** | Une vraie reconnaissance de caractère (deviner ce qui est dessiné) = gros chantier, écartée. Retenu : on **compare** le dessin au modèle KanjiVG connu (nombre, ordre, sens et forme des traits), l'app propose un verdict que l'utilisateur peut corriger (hybride) ; le modèle est celui de KanjiVG, sans graphies alternatives. |
| Nouvelles cartes | **Pas de limite quotidienne** ; c'est le **dictionnaire perso** qui joue ce rôle pour les kanji (une carte n'entre en révision que si l'utilisateur l'a ajoutée). **Les kana sont d'office dans le dictionnaire** : cocher « hiragana » = tous les hiragana, sinon aucun | Choix du propriétaire. Écarté : limite de N nouvelles cartes par jour (existait à l'étape 4, **retirée** par la migration `DailyGoal`). |
| Sessions | **Paramétrées à chaque lancement** (nombre de cartes, types, exercices), illimitées en nombre. Si la sélection ne contient pas assez de cartes, on **cycle** celles qui existent pour atteindre le nombre demandé | Chacun choisit son type d'exercice : si QCM et texte libre sont cochés, le mode est **tiré au hasard** à chaque carte (plus de règle liée à l'état de la carte). |
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

### Session de révision (implémentée, `learning/reviews.*`, `compose-session.ts`)

- **Réglage à chaque lancement** (`SessionConfig` dans `libs/shared`) : `count` (15 / 30 / 50), `types` (hiragana, katakana ; kanji viendra avec le dictionnaire), `modes` (`choice` = QCM, `typing` = texte libre, `drawing` = tracé, voir ci-dessous). Écran `/review/new` ; le dernier réglage est mémorisé par appareil (`localStorage`) ; la session se lance sur `/review?count=…&types=…&modes=…`.
- `GET /api/reviews/session?count=30&types=hiragana,katakana&modes=choice,typing` (validé strictement : taille parmi celles proposées, listes non vides, sans doublon, aucun autre paramètre). `composeSession` (fonction pure) compose `count` cartes parmi **tous** les items des types cochés, dans cet ordre : cartes **dues** (les plus en retard d'abord) → cartes **jamais vues**, **tirées au hasard** parmi toutes celles des types cochés (elles sont toutes au même niveau : pas d'ordre fixe, la sélection change d'une session à l'autre, hiragana et katakana se mélangent si les deux sont cochés) → cartes **vues mais pas encore dues** (la moins récemment vue d'abord) → si cela ne suffit pas, **cycle** : on repasse sur la même liste en tours successifs, sans jamais poser deux fois de suite la même carte (sauf s'il n'y en a qu'une). Le mode de chaque carte est tiré au hasard parmi les modes cochés. Le GET n'écrit rien : le `UserItem` est créé à la première réponse. Réponse : `counts` = `{ due, new, extra }` (`extra` = cartes déjà vues reposées pour compléter).
- QCM : 4 propositions, leurres = autres items du même type, jamais une réponse aussi valable comme « o » pour お/を.
- `GET /api/reviews/overview` : par type, cartes disponibles (`total`) et dues ; **réponses d'aujourd'hui** (`review_logs` depuis minuit, réussies ou non) ; objectif (`users.daily_goal`, défaut 30, 1–500, modifiable via `PATCH /users/me { dailyGoal }`, réglage dans le profil). Le « jour » suit `APP_TIMEZONE` (défaut `Europe/Paris`). Accueil : jauge `réponses du jour / objectif` en % (plafonnée à 100 à l'affichage, l'objectif n'est pas une limite) et bouton « Nouvelle session ».
- `POST /api/reviews { itemId, mode, answer, durationMs }` : le **serveur corrige** (`isRomajiCorrect`), déduit la note (`grading.ts`), puis, en une transaction, verrouille/crée le `UserItem`, écrit le `ReviewLog` (snapshot avant réponse) et applique FSRS (`enable_fuzz`). Notes : faux → Again ; juste → Good ; juste et > 8 s → Hard ; juste, **saisie** et < 2,5 s → Easy (jamais Easy au QCM). `durationMs` est plafonné à 120 s.
- Correction du romaji dans `libs/shared/src/lib/romaji.ts` (partagée API/front) : normalisation (casse, espaces, tirets, apostrophes) + variantes Hepburn / Nihon-shiki (shi/si, chi/ti, tsu/tu, fu/hu, ji/zi, sha/sya, cha/tya, ja/jya/zya, n/nn…). Les `readings` du seed contiennent déjà certaines variantes ; les règles complètent.
- Front (`features/review`) : une carte à la fois, grand caractère, retour immédiat calculé localement (le serveur fait foi ensuite), une carte **ratée est remise en fin de file** (`review-queue.ts` ; chaque place de la file a une `key`, car le cycle peut répéter un même item), bilan final (cartes, réussite sur première réponse, temps moyen, cartes à retravailler, prochaine échéance). Une sélection sans carte donne un 400 que la page affiche.
- **Limites connues** : `POST /reviews` n'est pas idempotent (un renvoi réseau compterait deux révisions) ; une bonne réponse à une carte en apprentissage n'est pas reposée dans la session (seules les ratées le sont) ; les réponses des cartes de complément (cycle, cartes pas encore dues) passent par FSRS comme les autres (choix assumé : un peu de précision de planification en moins) ; une première session peut proposer jusqu'à 50 cartes toutes nouvelles (on règle la taille soi-même).
- Le flux a été essayé à la main avec une vraie connexion Discord (OK) ; l'API est couverte par `reviews.integration.spec.ts`.

### Mode « Apprendre » pour les kana (implémenté, `learning/catalog.*`, `features/learn`)

- **Seed** : chaque kana a `metadata = { group, strokes }`. `group` ∈ `base` (46) / `voiced` (25, dakuten et handakuten) / `yoon` (33), dérivé des tables de `kana.data.ts` (`KANA_GROUP_ENTRIES`). `strokes` = traits dans l'ordre d'écriture (`StrokeDto` : chemin SVG `d` + position `n` du numéro, repère 109 × 109 de KanjiVG).
- **Tracés** : `tools/generate-kana-strokes.py` télécharge les SVG KanjiVG des kana simples (176 glyphes, hiragana et katakana) et écrit `seed/kana-glyphs.data.ts` (**généré et commité**, ne pas éditer ; relancer le script pour le régénérer). Les **yōon sont composés au seed** (`seed/kana-strokes.ts`) : le kana en i réduit à gauche + le petit ゃ / ゅ / ょ plus petit en bas à droite, les chemins SVG étant remis à l'échelle (`transformPath`, sans arcs : KanjiVG n'en utilise pas ici). Le seed met `metadata` à jour à chaque démarrage.
- **API** (`CatalogController`, protégé) : `GET /api/catalog` = les 208 kana dans l'ordre pédagogique, **sans** les tracés (lourds), avec `reading`, `group`, `mastery` ; `GET /api/catalog/:id` = fiche (lectures, tracés, `reps`, `lapses`, `nextDue`). 400 si l'id n'est pas un UUID, 404 si inconnu.
- **Maîtrise** (`mastery.ts`, déduite de l'état FSRS, 4 niveaux) : `unseen` (aucune réponse) → `learning` (Learning / Relearning) → `known` (Review) → `mastered` (Review et stabilité ≥ 21 jours, `MASTERED_STABILITY_DAYS`). Affichée sous chaque kana par trois segments (lisible sans la couleur, `aria-label` pour les lecteurs d'écran).
- **Front** : `/learn` (onglets Hiragana / Katakana, grilles par groupe ; le tableau de base reproduit la disposition classique : や ゆ よ en colonnes a u o, わ を aux extrémités, ん seul, `catalog-layout.ts`), `/learn/:id` (fiche + composant `StrokeOrder` : traits animés un par un par `stroke-dashoffset` avec `pathLength="1"`, fantôme gris, numéros, « Rejouer » ; `prefers-reduced-motion` : tout apparaît d'un coup), `/about` (licences KanjiVG et KANJIDIC2). Accès : lien « Apprendre » dans le menu du header (actif aussi sur les fiches), lien « À propos » en pied de page.
- **Pas fait** (volontairement) : le catalogue ne porte que les kana ; les kanji auront leur propre liste (recherche, filtre JLPT) au lot F, à cause de leur nombre. Pas d'étape « marquer comme lu » : consulter une fiche n'écrit rien.

### Exercice de tracé (implémenté, lot E : `drawing-pad.ts`, `review-page.ts`, `libs/shared/src/lib/drawing-score.ts`)

- **Déroulé** (mode `drawing`) : la carte affiche la **lecture** (« ka », jamais le caractère), l'utilisateur dessine le kana **au doigt** dans une zone de tracé, touche « Voir le modèle » ; le dessin et le **modèle animé** (ordre des traits, lot D) s'affichent côte à côte. L'app **compare** les deux et **propose un verdict**, que l'utilisateur confirme ou corrige d'un tap (**mode hybride**) : « Raté » / « Presque » / « Réussi », le verdict proposé étant mis en avant. Puis on enchaîne, sans écran de résultat.
- **Comparaison** (`scoreDrawing(user, model)`, fonction pure partagée, exécutée côté front) : le dessin est recadré sur le modèle (même centre, même plus grand côté : taille et position ne comptent pas) ; chaque trait est rééchantillonné (32 points) puis comparé au trait **de même rang** du modèle par l'**écart moyen** (en unités du repère 109 × 109, rapporté à la taille du trait, plancher 0,6). Réglages dans `DRAWING_SCORE` : juste ≤ 9, faux > 15, approximatif entre les deux. Fautes détectées et nommées à l'utilisateur : **nombre de traits** différent (exigé exact), **ordre**, **sens** (début du trait près de la fin du modèle ; non jugé sous 14 unités de long : accents, petits traits), **forme**, dessin **trop petit** (< 25 % du modèle). Les traits fautifs sont redessinés en rouge dans « Ton tracé ». Verdict : `good` (tout ≤ 9), `fair` (bon ordre et bon sens, un trait entre 9 et 15), `wrong` (au moins une faute).
- **Modèle = KanjiVG tel quel** (choix du propriétaire) : on ne tolère pas les graphies alternatives (ex. さ en 2 traits au lieu de 3, c'est une erreur). Les yōon sont comparés sur leur composition (voir « Mode Apprendre »).
- **Calibrage** (testé sur les 208 kana avec des tracés simulés : échelle, décalage, déformation lisse et bruit ; `drawing-score.spec.ts`) : le modèle recopié ou redimensionné est toujours « juste » ; une déformation légère n'est jamais fausse et reste « juste » plus de 9 fois sur 10 ; une déformation de 5 unités (≈ 5 % de la zone) est « fausse » moins d'une fois sur dix ; un trait inversé, deux traits permutés ou un nombre de traits différent sont toujours refusés ; un **autre** kana de même nombre de traits est refusé plus de 98 % du temps. **Limites** : les paires qui se ressemblent (ね / ぬ, る / ろ / そ, れ / わ) passent parfois en « Presque » ; les seuils sont réglés sur des tracés **simulés**, à ajuster avec de vrais tracés au doigt si le verdict paraît trop sévère ou trop clément.
- **Réservé au mobile** : l'option n'est proposée que si le pointeur principal est tactile (`isTouchDevice()` : `(pointer: coarse)`, donc pas un portable à écran tactile). Un réglage mémorisé qui contient le tracé est nettoyé sur un appareil non tactile (`adaptToDevice`). L'API, elle, accepte `modes=drawing` quel que soit l'appareil : c'est une limite d'interface, pas de sécurité.
- **Zone de tracé** : un `<svg>` dans le repère 109 × 109 de KanjiVG (dessin et modèle superposables), événements pointeur (`touch-action: none`, événements coalescés), traits lissés en courbes quadratiques (`drawing-path.ts`), « Annuler le dernier trait » / « Effacer », 30 traits max.
- **API** : `SessionCardDto.strokes` (le modèle) n'est présent que sur les cartes `drawing`. Une carte sans traits retombe sur le QCM (`modesFor`). `POST /reviews` : au tracé, `answer` est le **verdict** (`DRAWING_ANSWERS` : `correct` / `fair` / `wrong`), que le **serveur croit sur parole** (il ne revérifie pas le dessin : le tracé n'est pas envoyé). `isAnswerCorrect` (partagée) : `correct` et `fair` comptent juste. Notes : faux → Again ; `correct` → Good ; `fair` → **Hard** ; jamais Easy ; Hard aussi au-delà de 30 s (`SLOW_DRAWING_MS`). La durée s'arrête à l'affichage du modèle.
- **À savoir** : la session envoie le caractère de chaque carte (`item.character`), y compris pour les cartes de tracé, où il est la réponse : l'interface ne l'affiche qu'après le dessin, mais il est visible dans le réseau. Sans importance ici. Idée si les seuils s'avèrent fiables : retirer la correction manuelle du verdict.

### Cible : dictionnaire perso, « Apprendre », kanji (reste à faire)

> Déjà fait : sessions paramétrées, cycle, objectif quotidien, mode « Apprendre » pour les kana (voir ci-dessus). Reste : tout ce qui touche au dictionnaire perso et aux kanji, décrit ici.

Ce que cela change dans le modèle :

- **Dictionnaire perso = tous les kana + les kanji ajoutés.** Les **kana sont d'office** dans le dictionnaire de chacun (pas de bouton d'ajout, pas de sélection kana par kana : un type coché = tous ses éléments). Les **kanji** n'y entrent que sur ajout explicite (`POST` / `DELETE` sur le dictionnaire) : l'ajout crée le `UserItem` (état `New`, `due = now`). Un kana jamais révisé reste, lui, sans `UserItem` jusqu'à sa première réponse (création paresseuse, comme aujourd'hui) : **aucun rattrapage à prévoir** quand de nouveaux kana sont ajoutés au seed, ni à la création d'un compte. Les cartes éligibles d'une session = les items des types cochés qui sont des kana, ou des kanji ayant un `UserItem`.
- **Mode « Apprendre »** : catalogue de **tous** les éléments, kana compris (grille par écriture et par groupe : base, dakuten, yōon…), avec une **fiche détail** par élément : caractère, lectures (on/kun pour un kanji), sens, niveau JLPT, **ordre des traits animé** (KanjiVG, qui couvre aussi les kana). Sur une fiche kanji : bouton « Ajouter à mon dictionnaire » (ou retirer). Sur une fiche kana : pas de bouton, le kana y est déjà. Pour les kanji, l'ajout par caractère remplit tout seul la page (KANJIDIC2).
- **À brancher sur ce qui existe déjà** : le type `kanji` s'ajoutera à `SESSION_TYPES` (les candidats d'une session seront alors les kanji ayant un `UserItem`) ; le mode `drawing` (tracé) est déjà là et ne dépend que des données de traits de l'item (les kanji auront les leurs au lot F). `composeSession`, le cycle, l'objectif et l'écran de réglage n'ont pas à changer : la sélection vide (ex. « kanji » seul avec un dictionnaire sans kanji) renvoie déjà un 400 expliqué.
- `items.sort_order` (ordre pédagogique : あ い う…) n'intervient **plus** dans la composition des sessions (les cartes jamais vues sont tirées au hasard) ; il sert à ordonner les listes du mode « Apprendre ».
- **Question à trancher avant le lot kanji** : que demande-t-on sur un kanji (la lecture, le sens, ou les deux) ? Les lectures on/kun sont en kana : il faudra accepter romaji et hiragana en saisie. Les sens de KANJIDIC2 sont surtout en anglais (certains en français).


## 4. État actuel

Fait et vérifié (contre un vrai PostgreSQL, avec un Discord simulé) :
- Monorepo, Docker Compose, config nginx.
- Connexion Discord via Passport (state anti-CSRF en cookie, retour sur `/login?error=…` en cas d'échec ou de refus), session cookie, `GET/PATCH/DELETE /api/users/me`, suppression du compte en cascade, `GET /api/health`.
- Front : connexion, accueil vide, profil (pseudo, connexions liées, déconnexion, suppression du compte).
- Test d'intégration de l'authentification (`auth.integration.spec.ts`, voir README).
- Étape 3 : entités `Item` / `UserItem` / `ReviewLog`, migration `LearningSchema`, seed automatique des kana, test d'intégration `learning.integration.spec.ts` (bundle de production démarré sur base vierge : OK).

- Lot C : sessions : table `auth_sessions` (migration `AuthSessions`), `SessionService` (`issue` / `authenticate` / `logout` / `list` / `revoke`), `JwtAuthGuard` qui valide le `jti` en base et prolonge la session (cookie réémis), `SessionsController` (`GET/DELETE /api/users/me/sessions[/:id]`), `SessionCleanupService` (purge toutes les 6 h), section « Appareils connectés » du profil, intercepteur front qui renvoie vers `/login` sur un 401 ; `scripts/backup-db.sh` et `scripts/restore-db.sh` (restauration testée dans une base temporaire) ; tests : `sessions.integration.spec.ts` (déconnexion réelle, jetons refusés, expiration glissante et plafond, appareils, plafond de 20, purge), parseur de User-Agent, intercepteur.
- Lot B : PWA : `manifest.webmanifest`, icônes (`apps/web/public/icons`, générées par `tools/generate-icons.py`), `ngsw-config.json`, `provideServiceWorker` (production seulement), `AppUpdateService` + bannière « Nouvelle version disponible » dans le `Shell`, règles nginx ; garde-fous dans `apps/web/src/pwa.spec.ts`.
- Étape 4 : session de révision (API + écran mobile, voir § 3) ; tests de la correction du romaji, de la notation, des QCM, de la file côté front, et test d'intégration `reviews.integration.spec.ts`.
- Lot A : sessions paramétrées (taille, écritures, exercices, cycle), objectif quotidien (profil, accueil), migration `DailyGoal` ; tests de `composeSession`, du réglage et de l'objectif côté front, intégration de l'API (validation du réglage, ordre, cycle, objectif, isolation).

- Lot B vérifié dans Chrome (headless, serveur local) : le service worker s'enregistre, une navigation vers `/api/auth/discord` atteint bien le serveur (et échoue sans l'exclusion `/api`, contrôle négatif fait), les routes Angular sont servies par le service worker, `fetch('/api/…')` n'est jamais mis en cache, Chrome ne signale aucune erreur d'installabilité ; en-têtes nginx contrôlés sur l'image web construite (service worker sans cache, manifest en `application/manifest+json`, CSP conservée). Ce script de contrôle n'est pas dans le dépôt.

- Lot D : mode « Apprendre » pour les kana (voir § 3) : tracés KanjiVG des 208 kana, groupes, API du catalogue, maîtrise, pages `/learn`, `/learn/:id`, `/about` ; tests : `kana-strokes.spec.ts`, `mastery.spec.ts`, `catalog.integration.spec.ts`, `catalog-layout.spec.ts`, `stroke-order.spec.ts`. Vérifié dans Chrome (mobile, serveur de dev + API simulée) ; **pas encore vu en production**.

- Lot E : exercice de tracé avec comparaison automatique et verdict proposé (voir § 3) ; tests : `drawing-score.spec.ts` (208 kana, tracés simulés), `drawing-path.spec.ts`, `drawing-pad.spec.ts`, `drawing-feedback.spec.ts`, `device.spec.ts`, `session-config.spec.ts`, `grading.spec.ts` (notation et `modesFor`), `reviews.integration.spec.ts` (modèle des cartes, verdicts). Vérifié dans Chrome émulant un mobile (tracé au toucher, verdicts, trait fautif en rouge, enchaînement) avec une API simulée ; **pas encore essayé sur un vrai téléphone ni en production**, seuils non éprouvés sur de vrais tracés.

**Déploiement vérifié en production (VPS)** : le flux OAuth avec une vraie application Discord, l'affichage des avatars Discord et le `docker compose` (build et exécution) fonctionnent. Déploiement automatisé par le workflow `deploy.yml`.

**Non vérifié** : rien de connu pour l'instant.

## 5. Feuille de route

1. ~~Monorepo, Docker, auth Discord, profil~~ (fait).
2. ~~**Table de tokens de session**~~ (fait : voir le lot C, point 7).
3. ~~Schéma `Item` / `UserItem` / `ReviewLog` + données de base hiragana et katakana~~ (fait).
4. ~~Exercices QCM et saisie du romaji, avec FSRS branché dès le début ; écran de session~~ (fait). Reste à envisager : idempotence du POST.
5. ~~**Lot A** : sessions paramétrées (taille, écritures, exercices, cycle) + objectif quotidien (profil, jauge sur l'accueil), suppression de la limite quotidienne~~ (fait).
6. ~~**Lot B** : PWA (manifest, icônes, service worker qui ne met en cache que la coque de l'application, jamais l'API ; nginx qui ne met pas en cache le service worker ; bannière de mise à jour)~~ (fait).
7. ~~**Lot C** : sessions révocables (table `auth_sessions`, expiration glissante 48 h, déconnexion réelle, liste des appareils dans le profil) + sauvegarde de la base (`scripts/backup-db.sh`)~~ (fait). **Déployé sur le VPS et validé** (voir le README, section Production et sauvegarde).
8. ~~**Lot D** : mode « Apprendre » : catalogue (grilles par écriture et par groupe), fiches détail des kana avec ordre des traits animé (tracés KanjiVG des 208 kana, générés par script et commités), maîtrise par kana ; page « À propos » avec les licences (KanjiVG CC BY-SA, KANJIDIC2 EDRDG)~~ (fait ; voir § 3).
9. ~~**Lot E** : exercice de **tracé** sur mobile (zone de tracé tactile, comparaison automatique au modèle KanjiVG avec verdict proposé et corrigeable, mode `drawing` dans le réglage de session)~~ (fait ; voir § 3).
10. **Lot F** : kanji : import KANJIDIC2 (JSON généré par script), recherche et ajout par caractère, filtre JLPT, dictionnaire perso (`POST` / `DELETE`), type « kanji » dans les sessions, tracés KanjiVG des kanji, exercices kanji (question à trancher, voir § 3).
11. **Lot G** : statistiques (activité par jour, réussite, maîtrise par kana, série de jours, prévision des cartes dues ; en SVG/CSS, sans bibliothèque) ; idée : bot Discord (rappels de révision en DM, commandes slash).

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
- **PWA / service worker** :
  - **`/api` doit rester hors du service worker.** Par défaut il répond `index.html` à toute navigation ; or la connexion Discord et son retour sont des navigations vers `/api/auth/discord…`. C'est le rôle de `"!/api/**"` dans `navigationUrls` (`ngsw-config.json`) ; `dataGroups` doit rester vide. Un test (`pwa.spec.ts`) le garde.
  - **nginx ne doit jamais mettre en cache** `ngsw-worker.js`, `ngsw.json`, `safety-worker.js`, `manifest.webmanifest`, sinon les mises à jour n'arrivent plus. Leur règle doit venir **avant** la règle de cache d'un an sur les `.js`, et n'utiliser que `expires -1` : un `add_header` dans un `location` fait perdre au bloc les `add_header` du bloc `server` (CSP, nosniff).
  - Le service worker n'existe que dans le **build de production** (`nx build web`) ; `nx serve` n'en a pas. Pour le tester en local : construire l'image web (`docker build -f apps/web/Dockerfile .`) ou `docker compose up --build` ; `localhost` compte comme contexte sécurisé, HTTPS n'est requis qu'ailleurs.
  - Un navigateur garde l'ancienne version tant que l'utilisateur n'a pas rechargé : d'où la bannière de mise à jour. **Secours** si un service worker défectueux est déployé : `safety-worker.js` (livré avec Angular) désinstalle le service worker ; il suffit de le servir sous le nom `ngsw-worker.js`.
  - L'icône est un « か » **avec le point rouge en bas à droite** : en haut à droite, il se lit comme un dakuten (« が »).
- **UUID** : générés par `pgcrypto` (`gen_random_uuid`, natif depuis Postgres 13), aucune extension à installer.
- **Formulaires Angular** : un `<form>` avec seulement `ReactiveFormsModule` se soumet nativement (rechargement de page) ; utiliser `(submit)` + `preventDefault()` ou importer `FormsModule`.
- **IP réelle** : nginx (conteneur web) ne fait confiance à `X-Forwarded-For` que depuis les réseaux privés ; l'API a `trust proxy = 1`. Si un CDN (ex. Cloudflare en mode proxy) est placé devant, adapter la config pour que la limitation de débit voie la vraie IP.
- **Tests d'intégration : ils tournent sur `TEST_DATABASE_URL`, jamais sur la base du `.env`.** `ConfigModule.forRoot()` lit `process.env` à l'**import** de `AppModule` ; définir `DATABASE_URL` dans un `beforeAll` est trop tard, et les specs se connectaient alors à la **base de dev** et y faisaient leur `TRUNCATE users CASCADE` (compte, progression et sessions de dev effacés à chaque exécution ; découvert au lot C). Correctifs : `apps/api/jest.setup-env.ts` (Jest `setupFiles`) fixe l'environnement avant tout import et **refuse** une `TEST_DATABASE_URL` dont le nom de base ne contient pas « test » ; `assertTestDatabase()` est appelé avant chaque `TRUNCATE`. Créer la base une fois : `docker compose -f docker-compose.dev.yml exec db createdb -U kanadrill kanadrill_test`. Les tests ouvrent leurs sessions avec `SessionService.issue(userId)` (un cookie signé à la main n'a plus de session en base : 401).
- **Tests d'intégration, suite** : ils partagent une même base (`TRUNCATE users`, migrations). Jest tourne avec `maxWorkers: 1` pour l'API (`jest.config.cts`) ; en parallèle, le test d'auth échouait au hasard. Si le flux de profil Discord change (`DiscordStrategy.userProfile`), adapter la simulation dans `auth.integration.spec.ts`.
