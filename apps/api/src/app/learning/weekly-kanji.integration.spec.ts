/**
 * Test d'intégration du « kanji de la semaine » (vraie base PostgreSQL, migrations et seed réels).
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base,
 * ne la pointe jamais vers une base qui contient des données à garder.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import type { WeeklyKanjiDto, WeeklyKanjiResponse } from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { SESSION_COOKIE } from '../auth/session';
import { SessionService } from '../auth/session.service';
import { User } from '../users/user.entity';
import { mondayOf } from './weekly-kanji.service';
import { shiftDay } from './stats.service';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

describe('mondayOf', () => {
  it('donne le lundi de la semaine (lundi à dimanche)', () => {
    expect(mondayOf('2026-10-12')).toBe('2026-10-12'); // lundi
    expect(mondayOf('2026-10-14')).toBe('2026-10-12'); // mercredi
    expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // dimanche : encore la même semaine
    expect(mondayOf('2026-10-19')).toBe('2026-10-19'); // le lundi suivant : nouvelle semaine
    expect(mondayOf('2026-01-01')).toBe('2025-12-29'); // à cheval sur l'année
  });
});

(TEST_DATABASE_URL ? describe : describe.skip)('Kanji de la semaine', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let base: string;

  const loginAs = async (userId: string) => `${SESSION_COOKIE}=${(await app.get(SessionService).issue(userId)).token}`;
  const call = (cookie: string | undefined, method: string, path: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const makeUser = async (username: string) => {
    const user = await dataSource.getRepository(User).save({ username, avatarUrl: null });
    return { user, cookie: await loginAs(user.id) };
  };
  const weekly = async (cookie: string) => ((await (await call(cookie, 'GET', '/kanji/weekly')).json()) as WeeklyKanjiResponse).kanji;
  /** Ajoute au dictionnaire tous les kanji d'un niveau sauf ceux dont le caractère figure dans `except`. */
  const addLevel = (userId: string, level: string, except: string[] = []) =>
    dataSource.query(
      `INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE type = 'kanji' AND metadata ->> 'jlpt' = $2 AND NOT (character = ANY($3))`,
      [userId, level, except],
    );
  const n5 = async () => (await dataSource.query(`SELECT id, character FROM items WHERE type = 'kanji' AND metadata ->> 'jlpt' = 'N5' ORDER BY sort_order`)) as Array<{ id: string; character: string }>;

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
  }, 120_000);

  afterAll(async () => app?.close());

  it('exige une session', async () => {
    expect((await call(undefined, 'GET', '/kanji/weekly')).status).toBe(401);
  });

  it('propose un kanji N5 à un nouveau venu, avec son sens, ses lectures et la semaine en cours', async () => {
    const { cookie } = await makeUser('nouveau');
    const kanji = (await weekly(cookie)) as WeeklyKanjiDto;
    expect(kanji).toMatchObject({ jlpt: 'N5', inDictionary: false });
    expect(kanji.character).toHaveLength(1);
    expect(kanji.meanings.length).toBeGreaterThan(0);
    expect(kanji.meanings.length).toBeLessThanOrEqual(3);
    // La semaine commence un lundi et le prochain kanji arrive le lundi suivant.
    expect(new Date(`${kanji.weekStart}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(kanji.nextChange).toBe(shiftDay(kanji.weekStart, 7));
  });

  it('garde le même kanji toute la semaine, même après son ajout au dictionnaire', async () => {
    const { cookie } = await makeUser('stable');
    const first = (await weekly(cookie)) as WeeklyKanjiDto;
    expect(((await weekly(cookie)) as WeeklyKanjiDto).id).toBe(first.id);

    expect((await call(cookie, 'POST', '/dictionary', { itemIds: [first.id] })).status).toBe(200);
    const after = (await weekly(cookie)) as WeeklyKanjiDto;
    expect(after).toMatchObject({ id: first.id, inDictionary: true });

    // Le retirer le remet « à ajouter », toujours le même kanji.
    await call(cookie, 'DELETE', `/dictionary/${first.id}`);
    expect(await weekly(cookie)).toMatchObject({ id: first.id, inDictionary: false });
  });

  it('ne crée qu\'une suggestion par semaine, même avec des appels simultanés', async () => {
    const { user, cookie } = await makeUser('simultane');
    const results = await Promise.all(Array.from({ length: 6 }, () => weekly(cookie)));
    expect(new Set(results.map((kanji) => kanji?.id)).size).toBe(1);
    expect(await dataSource.query(`SELECT count(*)::int AS count FROM weekly_kanji WHERE user_id = $1`, [user.id])).toEqual([{ count: 1 }]);
  });

  it('tire parmi les kanji restants du niveau le plus bas : N5 tant qu\'il en reste', async () => {
    const { user, cookie } = await makeUser('presque-n5');
    const all = await n5();
    const left = all.slice(0, 3).map((k) => k.character);
    await addLevel(user.id, 'N5', left); // il ne reste que 3 kanji N5 à ajouter
    await dataSource.query(`INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE type = 'kanji' AND metadata ->> 'jlpt' = 'N4' LIMIT 10`, [user.id]); // et un peu de N4
    const kanji = (await weekly(cookie)) as WeeklyKanjiDto;
    expect(kanji.jlpt).toBe('N5');
    expect(left).toContain(kanji.character);
  });

  it('passe au niveau suivant quand tout un niveau est dans le dictionnaire', async () => {
    const { user, cookie } = await makeUser('tout-n5');
    await addLevel(user.id, 'N5');
    const kanji = (await weekly(cookie)) as WeeklyKanjiDto;
    expect(kanji.jlpt).toBe('N4');
    expect(kanji.inDictionary).toBe(false);
  });

  it('ne repropose pas le kanji de la semaine précédente tant qu\'il reste un autre candidat dans le niveau', async () => {
    const { user, cookie } = await makeUser('lundi');
    const [x, y] = (await n5()).slice(0, 2);
    await addLevel(user.id, 'N5', [x.character, y.character]); // restent x et y
    // La semaine dernière, x avait été proposé (et pas ajouté).
    const lastMonday = shiftDay(mondayOf(new Date().toISOString().slice(0, 10)), -7);
    await dataSource.query(`INSERT INTO weekly_kanji (user_id, item_id, week_start) VALUES ($1, $2, $3)`, [user.id, x.id, lastMonday]);
    for (let attempt = 0; attempt < 3; attempt++) {
      await dataSource.query(`DELETE FROM weekly_kanji WHERE user_id = $1 AND week_start <> $2`, [user.id, lastMonday]); // « nouvelle semaine »
      expect(((await weekly(cookie)) as WeeklyKanjiDto).id).toBe(y.id);
    }
  });

  it('reproposera le kanji de la semaine précédente s\'il est le seul restant de son niveau (sans sauter au niveau suivant)', async () => {
    const { user, cookie } = await makeUser('dernier');
    const [x] = await n5();
    await addLevel(user.id, 'N5', [x.character]);
    const lastMonday = shiftDay(mondayOf(new Date().toISOString().slice(0, 10)), -7);
    await dataSource.query(`INSERT INTO weekly_kanji (user_id, item_id, week_start) VALUES ($1, $2, $3)`, [user.id, x.id, lastMonday]);
    const kanji = (await weekly(cookie)) as WeeklyKanjiDto;
    expect(kanji).toMatchObject({ id: x.id, jlpt: 'N5' });
  });

  it('ne propose plus rien quand tous les kanji sont dans le dictionnaire', async () => {
    const { user, cookie } = await makeUser('complet');
    await dataSource.query(`INSERT INTO user_items (user_id, item_id) SELECT $1, id FROM items WHERE type = 'kanji'`, [user.id]);
    expect(await weekly(cookie)).toBeNull();
  });

  it('isole les utilisateurs et part avec le compte', async () => {
    const a = await makeUser('iso-a');
    const b = await makeUser('iso-b');
    await addLevel(a.user.id, 'N5'); // alice : N4 ; bob : toujours N5
    expect(((await weekly(a.cookie)) as WeeklyKanjiDto).jlpt).toBe('N4');
    expect(((await weekly(b.cookie)) as WeeklyKanjiDto).jlpt).toBe('N5');
    await call(a.cookie, 'DELETE', '/users/me');
    expect(await dataSource.query(`SELECT 1 FROM weekly_kanji WHERE user_id = $1`, [a.user.id])).toEqual([]);
  });
});
