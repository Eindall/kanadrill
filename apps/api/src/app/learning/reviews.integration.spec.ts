/**
 * Test d'intégration de la session de révision (vraie base PostgreSQL, migrations et seed réels).
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base
 * (et donc ses révisions), ne la pointe jamais vers une base qui contient des données à garder.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import {
  CARD_STATE,
  type ReviewOverviewDto,
  type ReviewResultDto,
  type ReviewSessionDto,
} from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { SESSION_COOKIE } from '../auth/session';
import { SessionService } from '../auth/session.service';
import { Item } from './item.entity';
import { ReviewLog } from './review-log.entity';
import { UserItem } from './user-item.entity';
import { User } from '../users/user.entity';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

(TEST_DATABASE_URL ? describe : describe.skip)('Session de révision', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let base: string;
  let cookieA: string;
  let cookieB: string;
  let userA: User;
  let userC: User;

  /** Ouvre une vraie session (ligne en base + jeton) et renvoie le cookie correspondant. */
  const loginAs = async (userId: string) => `${SESSION_COOKIE}=${(await app.get(SessionService).issue(userId)).token}`;

  const itemId = async (character: string) =>
    (await dataSource.getRepository(Item).findOneByOrFail({ character, type: 'hiragana' })).id;

  const call = (cookie: string | undefined, method: string, path: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const sessionUrl = (query: string) => `/reviews/session?${query}`;
  const getSession = async (cookie: string, query = 'count=15&types=hiragana&modes=choice') =>
    (await (await call(cookie, 'GET', sessionUrl(query))).json()) as ReviewSessionDto;
  const getOverview = async (cookie: string) =>
    (await (await call(cookie, 'GET', '/reviews/overview')).json()) as ReviewOverviewDto;
  const answer = (cookie: string, id: string, answerText: string, mode: 'choice' | 'typing' | 'drawing' = 'choice', durationMs = 3000) =>
    call(cookie, 'POST', '/reviews', { itemId: id, mode, answer: answerText, durationMs });
  const characters = (session: ReviewSessionDto) => session.cards.map((card) => card.item.character);

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

    const users = dataSource.getRepository(User);
    userA = await users.save({ username: 'alice', avatarUrl: null });
    const userB = await users.save({ username: 'bob', avatarUrl: null });
    userC = await users.save({ username: 'carol', avatarUrl: null });
    cookieA = await loginAs(userA.id);
    cookieB = await loginAs(userB.id);
  }, 60_000);

  afterAll(async () => app?.close());

  it('exige une session', async () => {
    expect((await call(undefined, 'GET', sessionUrl('count=15&types=hiragana&modes=choice'))).status).toBe(401);
    expect((await call(undefined, 'GET', '/reviews/overview')).status).toBe(401);
    expect((await call(undefined, 'POST', '/reviews', {})).status).toBe(401);
  });

  it('valide le réglage de la session', async () => {
    const status = async (query: string) => (await call(cookieA, 'GET', sessionUrl(query))).status;
    expect(await status('')).toBe(400);
    expect(await status('types=hiragana&modes=choice')).toBe(400); // pas de taille
    expect(await status('count=20&types=hiragana&modes=choice')).toBe(400); // taille non proposée
    expect(await status('count=15&modes=choice')).toBe(400); // pas de type
    expect(await status('count=15&types=&modes=choice')).toBe(400);
    expect(await status('count=15&types=kanji&modes=choice')).toBe(400); // pas encore disponible
    expect(await status('count=15&types=hiragana,hiragana&modes=choice')).toBe(400);
    expect(await status('count=15&types=hiragana')).toBe(400); // pas de mode
    expect(await status('count=15&types=hiragana&modes=dessin')).toBe(400);
    expect(await status('count=15&types=hiragana&modes=drawing')).toBe(200);
    expect(await status('count=15&types=hiragana&modes=choice&limit=3')).toBe(400);
    expect(await status('count=15&types=hiragana&modes=choice')).toBe(200);
    expect(await status('count=50&types=hiragana,katakana&modes=choice,typing')).toBe(200);
    expect(await status('count=30&types=hiragana&types=katakana&modes=choice')).toBe(200); // paramètre répété
  });

  it('propose des cartes jamais vues tirées au hasard (pas toujours あ い う…), avec QCM, sans rien écrire', async () => {
    const session = await getSession(cookieA, 'count=15&types=hiragana&modes=choice');
    expect(new Set(characters(session)).size).toBe(15);
    expect(session.cards.every((card) => card.item.type === 'hiragana')).toBe(true);
    // Deux sessions successives ne proposent pas la même liste dans le même ordre.
    const again = await getSession(cookieA, 'count=15&types=hiragana&modes=choice');
    expect(characters(again)).not.toEqual(characters(session));
    // 20 tirages de 15 parmi 104 : on ne reste pas cantonné aux 15 premiers kana de la table.
    const seenCharacters = new Set<string>();
    for (let i = 0; i < 20; i++) (await getSession(cookieA)).cards.forEach((card) => seenCharacters.add(card.item.character));
    expect(seenCharacters.size).toBeGreaterThan(15);
    expect(session.counts).toEqual({ due: 0, new: 15, extra: 0 });
    for (const card of session.cards) {
      expect(card).toMatchObject({ mode: 'choice', isNew: true });
      expect(card.choices).toHaveLength(4);
      expect(new Set(card.choices).size).toBe(4);
      expect(card.choices).toContain(card.item.readings[0]);
    }
    expect(await dataSource.getRepository(UserItem).countBy({ userId: userA.id })).toBe(0);
  });

  it('respecte la taille, les types et les exercices cochés', async () => {
    const big = await getSession(cookieA, 'count=50&types=hiragana,katakana&modes=choice');
    expect(big.cards).toHaveLength(50);
    expect(new Set(characters(big)).size).toBe(50);
    expect(new Set(big.cards.map((card) => card.item.type))).toEqual(new Set(['hiragana', 'katakana'])); // tirés dans les deux lots

    const katakana = await getSession(cookieA, 'count=15&types=katakana&modes=typing');
    expect(katakana.cards.every((card) => card.item.type === 'katakana')).toBe(true);
    expect(katakana.cards.every((card) => card.mode === 'typing' && card.choices === undefined)).toBe(true);

    const both = await getSession(cookieA, 'count=50&types=hiragana&modes=choice,typing');
    expect(new Set(both.cards.map((card) => card.mode))).toEqual(new Set(['choice', 'typing']));
    expect(both.cards.every((card) => (card.mode === 'choice') === (card.choices !== undefined))).toBe(true);
  });

  it('propose le modèle du tracé (traits) aux cartes « tracé », et seulement à elles', async () => {
    const drawing = await getSession(cookieA, 'count=15&types=hiragana,katakana&modes=drawing');
    expect(drawing.cards.every((card) => card.mode === 'drawing' && card.choices === undefined)).toBe(true);
    expect(drawing.cards.every((card) => (card.strokes?.length ?? 0) > 0 && card.strokes![0].d.startsWith('M'))).toBe(true);

    const mixed = await getSession(cookieA, 'count=50&types=hiragana&modes=choice,drawing');
    expect(new Set(mixed.cards.map((card) => card.mode))).toEqual(new Set(['choice', 'drawing']));
    expect(mixed.cards.every((card) => (card.mode === 'drawing') === (card.strokes !== undefined))).toBe(true);
  });

  it('prend le verdict d\'un tracé (juste, approximatif, raté) comme réponse', async () => {
    // Un compte à part : les tests d'isolation attendent que bob n'ait encore rien répondu.
    const dave = await dataSource.getRepository(User).save({ username: 'dave', avatarUrl: null });
    const cookieD = await loginAs(dave.id);
    const ok = (await (await answer(cookieD, await itemId('ま'), 'correct', 'drawing', 9000)).json()) as ReviewResultDto;
    expect(ok).toMatchObject({ correct: true, expected: 'ma', rating: 3 });
    const ko = (await (await answer(cookieD, await itemId('ね'), 'wrong', 'drawing', 9000)).json()) as ReviewResultDto;
    expect(ko).toMatchObject({ correct: false, expected: 'ne', rating: 1 });
    // « Approximatif » : compté juste, mais noté Hard.
    const fair = (await (await answer(cookieD, await itemId('む'), 'fair', 'drawing', 9000)).json()) as ReviewResultDto;
    expect(fair).toMatchObject({ correct: true, expected: 'mu', rating: 2 });
    // Ce que l'utilisateur « écrit » n'a pas de sens au tracé : seul le verdict compte.
    const other = (await (await answer(cookieD, await itemId('ほ'), 'ho', 'drawing', 9000)).json()) as ReviewResultDto;
    expect(other.correct).toBe(false);
  });

  it('indique les cartes disponibles par type et l\'objectif du jour', async () => {
    expect(await getOverview(cookieA)).toEqual({
      available: { hiragana: { total: 104, due: 0 }, katakana: { total: 104, due: 0 } },
      answersToday: 0,
      dailyGoal: 30,
    });
  });

  it('l\'objectif quotidien se règle sur le profil (borné)', async () => {
    for (const dailyGoal of [0, 501, 1.5, 'beaucoup']) {
      expect((await call(cookieA, 'PATCH', '/users/me', { dailyGoal })).status).toBe(400);
    }
    expect((await call(cookieA, 'PATCH', '/users/me', { dailyNewLimit: 3 })).status).toBe(400); // ancienne option retirée
    const res = await call(cookieA, 'PATCH', '/users/me', { dailyGoal: 45 });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { dailyGoal: number }).dailyGoal).toBe(45);
    expect((await getOverview(cookieA)).dailyGoal).toBe(45);
  });

  it('une bonne réponse crée la carte FSRS et le journal (snapshot avant réponse)', async () => {
    const before = Date.now();
    const res = await answer(cookieA, await itemId('あ'), 'a');
    expect(res.status).toBe(200);
    const result = (await res.json()) as ReviewResultDto;
    expect(result).toMatchObject({ correct: true, expected: 'a', rating: 3 });
    expect(new Date(result.nextDue).getTime()).toBeGreaterThan(before);

    const userItem = await dataSource.getRepository(UserItem).findOneByOrFail({ userId: userA.id, itemId: await itemId('あ') });
    expect(userItem).toMatchObject({ reps: 1, lapses: 0, state: CARD_STATE.Learning });
    expect(userItem.due.toISOString()).toBe(result.nextDue);

    const log = await dataSource.getRepository(ReviewLog).findOneByOrFail({ userId: userA.id, itemId: userItem.itemId });
    expect(log).toMatchObject({ rating: 3, durationMs: 3000, state: CARD_STATE.New, stability: 0 });
  });

  it('une mauvaise réponse note Again et donne la bonne lecture', async () => {
    const result = (await (await answer(cookieA, await itemId('い'), 'u')).json()) as ReviewResultDto;
    expect(result).toMatchObject({ correct: false, expected: 'i', rating: 1 });
  });

  it('accepte les variantes Hepburn / Nihon-shiki en saisie, et note Easy une saisie rapide', async () => {
    const result = (await (await answer(cookieA, await itemId('う'), 'U ', 'typing', 1000)).json()) as ReviewResultDto;
    expect(result).toMatchObject({ correct: true, rating: 4 });
    const si = (await (await answer(cookieA, await itemId('し'), 'si', 'typing')).json()) as ReviewResultDto;
    expect(si).toMatchObject({ correct: true, expected: 'shi' });
  });

  it('l\'objectif compte les réponses données, réussies ou non', async () => {
    expect((await getOverview(cookieA)).answersToday).toBe(4); // あ juste, い faux, う juste, し juste
  });

  it('garde de côté les cartes vues pas encore dues tant qu\'il reste des cartes jamais vues', async () => {
    // あ い う し viennent d'être vues : échéance dans quelques minutes, donc ni dues ni nouvelles.
    const session = await getSession(cookieA, 'count=50&types=hiragana&modes=choice');
    expect(session.counts).toEqual({ due: 0, new: 50, extra: 0 });
    expect(session.cards).toHaveLength(50);
    expect(characters(session)).not.toContain('あ');
  });

  it('met les cartes dues en premier, les plus en retard d\'abord', async () => {
    const repo = dataSource.getRepository(UserItem);
    const hour = 3_600_000;
    await repo.update({ userId: userA.id, itemId: await itemId('あ') }, { due: new Date(Date.now() - 2 * hour) });
    await repo.update(
      { userId: userA.id, itemId: await itemId('い') },
      { due: new Date(Date.now() - 3 * hour), state: CARD_STATE.Review },
    );
    const session = await getSession(cookieA);
    expect(characters(session).slice(0, 2)).toEqual(['い', 'あ']);
    expect(session.counts).toEqual({ due: 2, new: 13, extra: 0 });
    expect(session.cards.map((card) => card.isNew).slice(0, 3)).toEqual([false, false, true]);
    expect((await getOverview(cookieA)).available.hiragana).toEqual({ total: 104, due: 2 });
  });

  it('une carte en révision ratée compte un lapse', async () => {
    const result = (await (await answer(cookieA, await itemId('い'), 'x', 'typing')).json()) as ReviewResultDto;
    expect(result.rating).toBe(1);
    const userItem = await dataSource.getRepository(UserItem).findOneByOrFail({ userId: userA.id, itemId: await itemId('い') });
    expect(userItem).toMatchObject({ lapses: 1, state: CARD_STATE.Relearning });
  });

  it('complète avec des cartes déjà vues (la moins récemment vue d\'abord) quand tout a été vu', async () => {
    await dataSource.query(
      `INSERT INTO user_items (user_id, item_id, state, due, last_review)
       SELECT $1, id, 2, now() + interval '5 days', now() - (sort_order || ' hours')::interval
       FROM items WHERE type = 'hiragana'`,
      [userC.id],
    );
    const cookieC = await loginAs(userC.id);
    const session = await getSession(cookieC, 'count=15&types=hiragana&modes=choice');
    expect(session.counts).toEqual({ due: 0, new: 0, extra: 15 });
    expect(session.cards.every((card) => !card.isNew)).toBe(true);
    // sort_order 103 = dernier kana de la table (ぴょ) = vu il y a le plus longtemps.
    expect(characters(session)[0]).toBe('ぴょ');
  });

  it('le jour suivant, le compteur de l\'objectif repart de zéro', async () => {
    await dataSource.query(`UPDATE review_logs SET reviewed_at = reviewed_at - interval '2 days' WHERE user_id = $1`, [userA.id]);
    expect((await getOverview(cookieA)).answersToday).toBe(0);
  });

  it('isole les utilisateurs', async () => {
    const overview = await getOverview(cookieB);
    expect(overview).toMatchObject({ answersToday: 0, dailyGoal: 30 });
    const session = await getSession(cookieB);
    expect(session.counts).toEqual({ due: 0, new: 15, extra: 0 });
    expect(await dataSource.getRepository(ReviewLog).countBy({ userId: (await dataSource.getRepository(User).findOneByOrFail({ username: 'bob' })).id })).toBe(0);
  });

  it('valide les entrées', async () => {
    const id = await itemId('あ');
    expect((await call(cookieB, 'POST', '/reviews', { itemId: 'pas-un-uuid', mode: 'typing', answer: 'a', durationMs: 1 })).status).toBe(400);
    expect((await call(cookieB, 'POST', '/reviews', { itemId: id, mode: 'devinette', answer: 'a', durationMs: 1 })).status).toBe(400);
    expect((await call(cookieB, 'POST', '/reviews', { itemId: id, mode: 'typing', answer: 'a', durationMs: -5 })).status).toBe(400);
    expect((await call(cookieB, 'POST', '/reviews', { itemId: id, mode: 'typing', answer: 'a', durationMs: 1, rating: 4 })).status).toBe(400);
    expect((await call(cookieB, 'POST', '/reviews', { itemId: '00000000-0000-4000-8000-000000000000', mode: 'typing', answer: 'a', durationMs: 1 })).status).toBe(404);
  });

  it('plafonne une durée aberrante au lieu de refuser la réponse', async () => {
    const res = await answer(cookieB, await itemId('あ'), 'a', 'typing', 10 * 60 * 60 * 1000);
    expect(res.status).toBe(200);
    const bobId = (await dataSource.getRepository(User).findOneByOrFail({ username: 'bob' })).id;
    const log = await dataSource.getRepository(ReviewLog).findOneByOrFail({ userId: bobId });
    expect(log.durationMs).toBe(120_000);
    expect(log.rating).toBe(2); // bonne réponse mais lente : Hard
  });
});
