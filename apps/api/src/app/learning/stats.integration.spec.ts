/**
 * Test d'intégration des statistiques et du classement (vraie base PostgreSQL, migrations et seed réels).
 * Les réponses sont insérées à des dates précises (en heure de Paris, le fuseau par défaut) pour tester les séries,
 * les jours et leurs frontières.
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base,
 * ne la pointe jamais vers une base qui contient des données à garder.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { CARD_STATE, type IsoDay, type LeaderboardDto, type StatsDto, type StatsOverviewDto, type WeeklyLeaderboardDto, type WeeklyMetric } from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { SESSION_COOKIE } from '../auth/session';
import { SessionService } from '../auth/session.service';
import { User } from '../users/user.entity';
import { shiftDay, StatsService } from './stats.service';
import { mondayOf } from './weekly-kanji.service';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

(TEST_DATABASE_URL ? describe : describe.skip)('Statistiques et classement', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let base: string;
  let today: IsoDay;
  const itemIds: Record<string, string> = {};

  const loginAs = async (userId: string) => `${SESSION_COOKIE}=${(await app.get(SessionService).issue(userId)).token}`;
  const call = (cookie: string | undefined, method: string, path: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const get = async <T>(cookie: string, path: string) => (await (await call(cookie, 'GET', path)).json()) as T;
  const makeUser = async (username: string) => {
    const user = await dataSource.getRepository(User).save({ username, avatarUrl: null });
    return { user, cookie: await loginAs(user.id) };
  };
  const day = (offset: number): IsoDay => shiftDay(today, offset);

  /** Une réponse donnée le jour `date` à l'heure locale `time` (Paris). */
  const answer = (userId: string, character: string, date: IsoDay, time = '12:00', rating = 3) =>
    dataSource.query(
      `INSERT INTO review_logs (user_id, item_id, rating, duration_ms, reviewed_at, state, due, stability, difficulty, elapsed_days, last_elapsed_days, scheduled_days, learning_steps)
       VALUES ($1, $2, $3, 2000, ($4::date + $5::time) AT TIME ZONE 'Europe/Paris', 0, now(), 0, 0, 0, 0, 0, 0)`,
      [userId, itemIds[character], rating, date, time],
    );
  const answerDays = async (userId: string, offsets: number[], character = 'あ') => {
    for (const offset of offsets) await answer(userId, character, day(offset));
  };

  /** Un tracé fait le jour `date` à `time` : précision annoncée et note (1 = raté, 2+ = compté). */
  const drawn = (userId: string, date: IsoDay, time: string, precision: number | null, rating = 3) =>
    dataSource.query(
      `INSERT INTO review_logs (user_id, item_id, rating, duration_ms, reviewed_at, drawing_precision, state, due, stability, difficulty, elapsed_days, last_elapsed_days, scheduled_days, learning_steps)
       VALUES ($1, $2, $3, 2000, ($4::date + $5::time) AT TIME ZONE 'Europe/Paris', $6, 0, now(), 0, 0, 0, 0, 0, 0)`,
      [userId, itemIds['あ'], rating, date, time, precision],
    );

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-test-secret-test-secret-test',
      APP_URL: 'http://localhost:4200',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_REDIRECT_URI: 'http://localhost:4200/api/auth/discord/callback',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    dataSource = app.get(DataSource);
    assertTestDatabase(dataSource); // jamais la base du .env
    await dataSource.query('TRUNCATE users CASCADE');
    today = await app.get(StatsService).today();
    for (const [id, character] of (await dataSource.query(`SELECT id, character FROM items WHERE type = 'hiragana'`)).map((r: { id: string; character: string }) => [r.id, r.character])) {
      itemIds[character] = id;
    }
  }, 120_000);

  afterAll(async () => app?.close());

  it('exige une session', async () => {
    for (const path of ['/stats', '/stats/overview', '/leaderboard', '/leaderboard/weekly?metric=answers']) {
      expect([path, (await call(undefined, 'GET', path)).status]).toEqual([path, 401]);
    }
  });

  describe('séries de jours', () => {
    it('compte les jours consécutifs jusqu\'à aujourd\'hui, avec au moins une réponse par jour', async () => {
      const { user, cookie } = await makeUser('serie-a');
      // Aujourd'hui, hier, avant-hier ; trou ; puis une suite plus courte, et un jour isolé plus ancien.
      await answerDays(user.id, [0, -1, -2, -4, -5, -9]);
      const overview = await get<StatsOverviewDto>(cookie, '/stats/overview');
      expect(overview.streak).toEqual({ current: 3, longest: 3, activeToday: true });
    });

    it('ne casse pas la série tant que la journée n\'est pas finie (rien aujourd\'hui, mais hier)', async () => {
      const { user, cookie } = await makeUser('serie-b');
      await answerDays(user.id, [-1, -2, -3, -4]);
      expect((await get<StatsOverviewDto>(cookie, '/stats/overview')).streak).toEqual({ current: 4, longest: 4, activeToday: false });
    });

    it('remet la série à zéro après un jour entier sans répondre, en gardant le record', async () => {
      const { user, cookie } = await makeUser('serie-c');
      await answerDays(user.id, [-2, -3, -4, -5, -6]);
      expect((await get<StatsOverviewDto>(cookie, '/stats/overview')).streak).toEqual({ current: 0, longest: 5, activeToday: false });
    });

    it('commence à zéro sans aucune réponse', async () => {
      const { cookie } = await makeUser('serie-d');
      expect((await get<StatsOverviewDto>(cookie, '/stats/overview')).streak).toEqual({ current: 0, longest: 0, activeToday: false });
    });

    it('découpe les journées à minuit heure de Paris, pas à minuit UTC', async () => {
      const { user, cookie } = await makeUser('serie-minuit');
      await answer(user.id, 'あ', day(-1), '23:30'); // 21 h 30 UTC (été) ou 22 h 30 (hiver) : la veille, dans les deux fuseaux…
      await answer(user.id, 'い', day(0), '00:30'); // … et 22 h 30 UTC la veille (été) : aujourd'hui seulement à Paris
      const overview = await get<StatsOverviewDto>(cookie, '/stats/overview');
      expect(overview.recent.slice(-2).map((d) => [d.date, d.answers])).toEqual([[day(-1), 1], [day(0), 1]]);
      expect(overview.streak.current).toBe(2);
    });
  });

  describe('accueil', () => {
    it('donne les 7 derniers jours (du plus ancien à aujourd\'hui), l\'objectif et les réponses du jour', async () => {
      const { user, cookie } = await makeUser('accueil');
      await answerDays(user.id, [0, 0, 0, -1, -6]);
      await answer(user.id, 'う', day(0), '13:00', 1); // une réponse ratée
      const overview = await get<StatsOverviewDto>(cookie, '/stats/overview');
      expect(overview).toMatchObject({ today, dailyGoal: 30 });
      expect(overview.recent).toHaveLength(7);
      expect(overview.recent[0].date).toBe(day(-6));
      expect(overview.recent[6].date).toBe(today);
      expect(overview.recent.map((d) => d.answers)).toEqual([1, 0, 0, 0, 0, 1, 4]);
      expect(overview.recent[6]).toEqual({ date: today, answers: 4, correct: 3 }); // la réponse de note 1 n'est pas « réussie »
    });
  });

  describe('statistiques détaillées', () => {
    it('renvoie 30 jours par défaut, jour par jour (même sans réponse), avec les totaux', async () => {
      const { user, cookie } = await makeUser('stats-a');
      await answerDays(user.id, [0, 0, -3, -29, -40]);
      await answer(user.id, 'え', day(-3), '10:00', 1);
      const stats = await get<StatsDto>(cookie, '/stats');
      expect(stats.to).toBe(today);
      expect(stats.from).toBe(day(-29));
      expect(stats.days).toHaveLength(30);
      expect(stats.days[0]).toEqual({ date: day(-29), answers: 1, correct: 1 });
      expect(stats.days.find((d) => d.date === day(-3))).toEqual({ date: day(-3), answers: 2, correct: 1 });
      expect(stats.totals).toEqual({ answers: 5, correct: 4, activeDays: 3, distinctItems: 2 }); // la réponse d'il y a 40 jours est hors période
    });

    it('accepte une période prédéfinie ou une plage de dates', async () => {
      const { user, cookie } = await makeUser('stats-b');
      await answerDays(user.id, [0, -5, -20, -60]);
      expect((await get<StatsDto>(cookie, '/stats?days=7')).days).toHaveLength(7);
      expect((await get<StatsDto>(cookie, '/stats?days=90')).totals.answers).toBe(4);
      const range = await get<StatsDto>(cookie, `/stats?from=${day(-25)}&to=${day(-15)}`);
      expect(range).toMatchObject({ from: day(-25), to: day(-15) });
      expect(range.days).toHaveLength(11);
      expect(range.totals.answers).toBe(1);
      // `to` au-delà d'aujourd'hui : ramené à aujourd'hui.
      expect((await get<StatsDto>(cookie, `/stats?from=${day(-2)}&to=${day(10)}`)).to).toBe(today);
      // `from` seul : jusqu'à aujourd'hui.
      expect((await get<StatsDto>(cookie, `/stats?from=${day(-4)}`)).days).toHaveLength(5);
    });

    it('valide la période', async () => {
      const { cookie } = await makeUser('stats-c');
      const status = async (query: string) => (await call(cookie, 'GET', `/stats${query}`)).status;
      expect(await status('?days=15')).toBe(400); // pas une période proposée
      expect(await status('?from=2026-02-31')).toBe(400); // jour inexistant
      expect(await status('?from=demain')).toBe(400);
      expect(await status(`?from=${day(-3)}&to=${day(-9)}`)).toBe(400); // fin avant début
      expect(await status(`?to=${day(-3)}`)).toBe(400); // `to` sans `from`
      expect(await status(`?days=7&from=${day(-3)}`)).toBe(400); // les deux
      expect(await status('?from=2000-01-01')).toBe(400); // plus de 731 jours
      expect(await status('?foo=1')).toBe(400);
      expect(await status('?days=7')).toBe(200);
    });

    it('liste les éléments les plus ratés pendant la période', async () => {
      const { user, cookie } = await makeUser('stats-d');
      for (let i = 0; i < 3; i++) await answer(user.id, 'あ', day(-1), `0${i + 8}:00`, 1);
      await answer(user.id, 'あ', day(-1), '12:00', 3);
      await answer(user.id, 'い', day(-1), '12:00', 1);
      await answer(user.id, 'う', day(-1), '12:00', 3); // jamais raté : absent
      await answer(user.id, 'え', day(-100), '12:00', 1); // hors période
      const { weakest } = await get<StatsDto>(cookie, '/stats');
      expect(weakest.map((w) => [w.character, w.label, w.answers, w.misses])).toEqual([['あ', 'a', 4, 3], ['い', 'i', 1, 1]]);
    });

    it('répartit la maîtrise : kana sans carte = jamais vus, kanji du dictionnaire par niveau', async () => {
      const { user, cookie } = await makeUser('stats-e');
      const kanji = await dataSource.query(`SELECT id, metadata ->> 'jlpt' AS jlpt FROM items WHERE type = 'kanji' AND metadata ->> 'jlpt' = 'N5' LIMIT 2`);
      const insert = (itemId: string, state: number, reps: number, stability: number) =>
        dataSource.query(`INSERT INTO user_items (user_id, item_id, state, reps, stability) VALUES ($1, $2, $3, $4, $5)`, [user.id, itemId, state, reps, stability]);
      await insert(itemIds['あ'], CARD_STATE.Learning, 1, 0.4);
      await insert(itemIds['い'], CARD_STATE.Review, 5, 10);
      await insert(itemIds['う'], CARD_STATE.Review, 9, 40);
      await insert(kanji[0].id, CARD_STATE.New, 0, 0); // ajouté au dictionnaire, jamais répondu
      await insert(kanji[1].id, CARD_STATE.Review, 4, 25);
      const { mastery } = await get<StatsDto>(cookie, '/stats');
      expect(mastery.hiragana).toEqual({ unseen: 101, learning: 1, known: 1, mastered: 1 });
      expect(mastery.katakana).toEqual({ unseen: 104, learning: 0, known: 0, mastered: 0 });
      expect(mastery.kanji).toEqual({ N5: { unseen: 1, learning: 0, known: 0, mastered: 1 } });
    });

    it('prévoit les cartes à revoir : les retards comptent aujourd\'hui, les cartes neuves ne comptent pas', async () => {
      const { user, cookie } = await makeUser('stats-f');
      const insert = (character: string, state: number, due: string) =>
        dataSource.query(`INSERT INTO user_items (user_id, item_id, state, reps, due) VALUES ($1, $2, $3, 2, ($4::date + time '12:00') AT TIME ZONE 'Europe/Paris')`, [user.id, itemIds[character], state, due]);
      await insert('あ', CARD_STATE.Review, day(-5)); // en retard
      await insert('い', CARD_STATE.Review, day(0));
      await insert('う', CARD_STATE.Learning, day(2));
      await insert('え', CARD_STATE.Review, day(2));
      await insert('お', CARD_STATE.Review, day(13));
      await insert('か', CARD_STATE.Review, day(14)); // au-delà de la fenêtre
      await insert('き', CARD_STATE.New, day(1)); // carte neuve : pas une révision
      const { forecast } = await get<StatsDto>(cookie, '/stats');
      expect(forecast).toHaveLength(14);
      expect(forecast[0]).toEqual({ date: today, due: 2 });
      expect(forecast[2]).toEqual({ date: day(2), due: 2 });
      expect(forecast[13]).toEqual({ date: day(13), due: 1 });
      expect(forecast.reduce((sum, d) => sum + d.due, 0)).toBe(5);
    });

    it('isole les utilisateurs', async () => {
      const { cookie } = await makeUser('stats-vide');
      const stats = await get<StatsDto>(cookie, '/stats');
      expect(stats.totals).toEqual({ answers: 0, correct: 0, activeDays: 0, distinctItems: 0 });
      expect(stats.weakest).toEqual([]);
      expect(stats.forecast.every((d) => d.due === 0)).toBe(true);
    });
  });

  describe('classement', () => {
    it('classe les séries en cours, partage le rang à égalité, et ne montre que les utilisateurs visibles', async () => {
      await dataSource.query('TRUNCATE users CASCADE');
      const alice = await makeUser('alice');
      const bob = await makeUser('bob');
      const carol = await makeUser('carol');
      const dave = await makeUser('dave');
      const eve = await makeUser('eve');
      await answerDays(alice.user.id, [0, -1, -2, -3]); // 4
      await answerDays(bob.user.id, [0, -1, -2, -3]); // 4, même record : égalité avec alice
      await answerDays(carol.user.id, [-1, -2, -3, -4, -5, -6]); // 6 (hier compte)
      await answerDays(dave.user.id, [-3, -4, -5]); // série terminée : 0, hors classement
      await answerDays(eve.user.id, [0, -1, -2, -3, -4, -5, -6, -7]); // 8 mais masquée
      expect((await call(eve.cookie, 'PATCH', '/users/me', { leaderboardVisible: false })).status).toBe(200);

      const board = await get<LeaderboardDto>(alice.cookie, '/leaderboard');
      expect(board.entries.map((e) => [e.rank, e.username, e.currentStreak, e.isMe])).toEqual([
        [1, 'carol', 6, false],
        [2, 'alice', 4, true],
        [2, 'bob', 4, false],
      ]);
      expect(board.total).toBe(3);
      expect(board.me).toEqual({ rank: 2, currentStreak: 4, longestStreak: 4, visible: true });
      // Pas de fuite : ni identifiant, ni utilisateur masqué.
      expect(JSON.stringify(board)).not.toContain(eve.user.id);
      expect(JSON.stringify(board)).not.toContain('eve');

      // Un utilisateur masqué voit sa propre situation, sans figurer dans la liste.
      const hidden = await get<LeaderboardDto>(eve.cookie, '/leaderboard');
      expect(hidden.me).toEqual({ rank: null, currentStreak: 8, longestStreak: 8, visible: false });
      expect(hidden.entries.some((e) => e.isMe)).toBe(false);
      // Sans série en cours : pas de rang non plus.
      expect((await get<LeaderboardDto>(dave.cookie, '/leaderboard')).me).toEqual({ rank: null, currentStreak: 0, longestStreak: 3, visible: true });
    });

    it('permet de se démasquer et valide le réglage', async () => {
      const { user, cookie } = await makeUser('visible');
      await answerDays(user.id, [0]);
      expect((await call(cookie, 'PATCH', '/users/me', { leaderboardVisible: 'oui' })).status).toBe(400);
      await call(cookie, 'PATCH', '/users/me', { leaderboardVisible: false });
      expect((await get<{ leaderboardVisible: boolean }>(cookie, '/users/me')).leaderboardVisible).toBe(false);
      await call(cookie, 'PATCH', '/users/me', { leaderboardVisible: true });
      expect((await get<LeaderboardDto>(cookie, '/leaderboard')).me.rank).not.toBeNull();
    });
  });

  describe('classements de la semaine', () => {
    const weekly = (cookie: string, metric: WeeklyMetric) => get<WeeklyLeaderboardDto>(cookie, `/leaderboard/weekly?metric=${metric}`);

    it('valide le paramètre', async () => {
      const { cookie } = await makeUser('hebdo-validation');
      for (const query of ['', '?metric=streak', '?metric=answers&extra=1']) {
        expect([query, (await call(cookie, 'GET', `/leaderboard/weekly${query}`)).status]).toEqual([query, 400]);
      }
    });

    it('compte les réponses du lundi (00:00, heure de Paris) au dimanche, pas celles de la semaine passée', async () => {
      await dataSource.query('TRUNCATE users CASCADE');
      const monday = mondayOf(today);
      const alice = await makeUser('alice');
      const bob = await makeUser('bob');
      const carol = await makeUser('carol');
      const eve = await makeUser('eve');
      // alice : 3 cette semaine (dont une à minuit pile le lundi), dont 1 ratée ; 5 la semaine dernière (ignorées).
      await answer(alice.user.id, 'あ', monday, '00:00:00');
      await answer(alice.user.id, 'あ', monday, '12:00', 1);
      await answer(alice.user.id, 'い', monday, '18:00');
      for (let i = 0; i < 5; i++) await answer(alice.user.id, 'あ', shiftDay(monday, -1), '23:59:59');
      // bob : 3 également (égalité de rang), toutes réussies.
      await answer(bob.user.id, 'あ', monday, '09:00');
      await answer(bob.user.id, 'い', monday, '10:00', 4);
      await answer(bob.user.id, 'う', monday, '11:00', 2);
      // carol : 5.
      for (let i = 0; i < 5; i++) await answer(carol.user.id, 'あ', monday, `0${i + 1}:00`);
      // eve : 9 mais masquée.
      for (let i = 0; i < 9; i++) await answer(eve.user.id, 'あ', monday, `0${i + 1}:30`);
      await call(eve.cookie, 'PATCH', '/users/me', { leaderboardVisible: false });

      const board = await weekly(alice.cookie, 'answers');
      expect(board).toMatchObject({ metric: 'answers', weekStart: monday, nextWeekStart: shiftDay(monday, 7) });
      expect(board.entries.map((e) => [e.rank, e.username, e.value, e.detail, e.isMe])).toEqual([
        [1, 'carol', 5, 100, false],
        [2, 'alice', 3, 67, true],
        [2, 'bob', 3, 100, false],
      ]);
      expect(board.me).toEqual({ rank: 2, value: 3, detail: 67, visible: true });
      expect(board.total).toBe(3);
      expect(JSON.stringify(board)).not.toContain('eve');
      expect(JSON.stringify(board)).not.toContain(eve.user.id);
      expect((await weekly(eve.cookie, 'answers')).me).toEqual({ rank: null, value: 9, detail: 100, visible: false });
    });

    it('classe les points de tracé : somme des précisions des tracés réussis, les ratés valent 0, les tracés sans précision ne comptent pas', async () => {
      await dataSource.query('TRUNCATE users CASCADE');
      const monday = mondayOf(today);
      const alice = await makeUser('alice');
      const bob = await makeUser('bob');
      const carol = await makeUser('carol');
      const dave = await makeUser('dave');
      await drawn(alice.user.id, monday, '10:00', 90); // 90
      await drawn(alice.user.id, monday, '11:00', 70, 2); // « presque » : 70
      await drawn(alice.user.id, monday, '12:00', 30, 1); // raté (corrigé à la main) : 0 point, mais un tracé de plus
      await drawn(alice.user.id, shiftDay(monday, -3), '12:00', 100); // semaine passée : ignoré
      await drawn(bob.user.id, monday, '10:00', 100); // 100 en un seul tracé
      await drawn(bob.user.id, monday, '10:30', null); // sans précision : ignoré
      await answer(bob.user.id, 'あ', monday, '11:00'); // un QCM : ne compte pas non plus ici
      await drawn(carol.user.id, monday, '10:00', 0, 1); // 0 point : hors classement
      await drawn(dave.user.id, monday, '10:00', 160 - 60); // 100 : égalité avec bob

      const board = await weekly(alice.cookie, 'drawing');
      expect(board.entries.map((e) => [e.rank, e.username, e.value, e.detail])).toEqual([
        [1, 'alice', 160, 3],
        [2, 'bob', 100, 1],
        [2, 'dave', 100, 1],
      ]);
      expect(board.me).toEqual({ rank: 1, value: 160, detail: 3, visible: true });
      expect((await weekly(carol.cookie, 'drawing')).me).toEqual({ rank: null, value: 0, detail: 1, visible: true });
    });

    it('applique l\'option de masquage du classement des séries aux classements de la semaine', async () => {
      await dataSource.query('TRUNCATE users CASCADE');
      const monday = mondayOf(today);
      const { user, cookie } = await makeUser('masquable');
      await drawn(user.id, monday, '10:00', 80);
      expect((await weekly(cookie, 'drawing')).me.rank).toBe(1);
      await call(cookie, 'PATCH', '/users/me', { leaderboardVisible: false });
      const hidden = await weekly(cookie, 'drawing');
      expect(hidden.entries).toEqual([]);
      expect(hidden.me).toEqual({ rank: null, value: 80, detail: 1, visible: false });
    });
  });
});
