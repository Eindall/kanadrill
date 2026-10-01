/**
 * Test d'intégration de la session de révision (vraie base PostgreSQL, migrations et seed réels).
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base
 * (et donc ses révisions), ne la pointe jamais vers une base qui contient des données à garder.
 */
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { CARD_STATE, type ReviewResultDto, type ReviewSessionDto } from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { SESSION_COOKIE } from '../auth/session';
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

  const itemId = async (character: string) =>
    (await dataSource.getRepository(Item).findOneByOrFail({ character, type: 'hiragana' })).id;

  const call = (cookie: string | undefined, method: string, path: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const getSession = async (cookie: string) => (await (await call(cookie, 'GET', '/reviews/session')).json()) as ReviewSessionDto;
  const answer = (cookie: string, id: string, answerText: string, mode: 'choice' | 'typing' = 'choice', durationMs = 3000) =>
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
    await dataSource.query('TRUNCATE users CASCADE');

    const users = dataSource.getRepository(User);
    userA = await users.save({ username: 'alice', avatarUrl: null });
    const userB = await users.save({ username: 'bob', avatarUrl: null });
    const jwt = app.get(JwtService);
    cookieA = `${SESSION_COOKIE}=${await jwt.signAsync({ sub: userA.id })}`;
    cookieB = `${SESSION_COOKIE}=${await jwt.signAsync({ sub: userB.id })}`;
  }, 60_000);

  afterAll(async () => app?.close());

  it('exige une session', async () => {
    expect((await call(undefined, 'GET', '/reviews/session')).status).toBe(401);
    expect((await call(undefined, 'POST', '/reviews', {})).status).toBe(401);
  });

  it('propose les 10 premières nouvelles cartes dans l\'ordre pédagogique, avec QCM', async () => {
    const session = await getSession(cookieA);
    expect(characters(session)).toEqual(['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ']);
    expect(session.counts).toEqual({ due: 0, new: 10 });
    expect(session.dailyNewLimit).toBe(10);
    for (const card of session.cards) {
      expect(card).toMatchObject({ mode: 'choice', isNew: true });
      expect(card.choices).toHaveLength(4);
      expect(new Set(card.choices).size).toBe(4);
      expect(card.choices).toContain(card.item.readings[0]);
    }
    // Un GET n'écrit rien.
    expect(await dataSource.getRepository(UserItem).countBy({ userId: userA.id })).toBe(0);
  });

  it('la limite quotidienne se règle sur le profil (bornée)', async () => {
    expect((await call(cookieA, 'PATCH', '/users/me', { dailyNewLimit: 101 })).status).toBe(400);
    expect((await call(cookieA, 'PATCH', '/users/me', { dailyNewLimit: -1 })).status).toBe(400);
    const res = await call(cookieA, 'PATCH', '/users/me', { dailyNewLimit: 3 });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { dailyNewLimit: number }).dailyNewLimit).toBe(3);
    expect(characters(await getSession(cookieA))).toEqual(['あ', 'い', 'う']);
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

  it('la limite quotidienne est consommée : plus de nouvelles cartes (し compte aussi)', async () => {
    const session = await getSession(cookieA);
    expect(session.counts.new).toBe(0);
    expect(characters(session)).toEqual([]); // les cartes en apprentissage ne sont dues que dans quelques minutes
  });

  it('renvoie les cartes dues (QCM en apprentissage, saisie en révision), les plus anciennes d\'abord', async () => {
    const repo = dataSource.getRepository(UserItem);
    const hour = 3_600_000;
    await repo.update({ userId: userA.id, itemId: await itemId('あ') }, { due: new Date(Date.now() - 2 * hour) });
    await repo.update(
      { userId: userA.id, itemId: await itemId('い') },
      { due: new Date(Date.now() - 3 * hour), state: CARD_STATE.Review },
    );
    const session = await getSession(cookieA);
    expect(characters(session)).toEqual(['い', 'あ']);
    expect(session.counts).toEqual({ due: 2, new: 0 });
    expect(session.cards[0]).toMatchObject({ mode: 'typing', isNew: false });
    expect(session.cards[0].choices).toBeUndefined();
    expect(session.cards[1]).toMatchObject({ mode: 'choice', isNew: false });
  });

  it('une carte en révision ratée compte un lapse', async () => {
    const result = (await (await answer(cookieA, await itemId('い'), 'x', 'typing')).json()) as ReviewResultDto;
    expect(result.rating).toBe(1);
    const userItem = await dataSource.getRepository(UserItem).findOneByOrFail({ userId: userA.id, itemId: await itemId('い') });
    expect(userItem).toMatchObject({ lapses: 1, state: CARD_STATE.Relearning });
  });

  it('le jour suivant, la limite repart de zéro (sans reproposer les cartes déjà vues)', async () => {
    await dataSource.query(`UPDATE review_logs SET reviewed_at = reviewed_at - interval '2 days' WHERE user_id = $1`, [userA.id]);
    const session = await getSession(cookieA);
    expect(session.counts.new).toBe(3);
    // Les nouvelles cartes suivent あ い う し (déjà vues) ; あ revient seulement parce qu'elle est encore due.
    const fresh = session.cards.filter((card) => card.isNew).map((card) => card.item.character);
    expect(fresh).toEqual(['え', 'お', 'か']);
  });

  it('isole les utilisateurs', async () => {
    const session = await getSession(cookieB);
    expect(session.counts).toEqual({ due: 0, new: 10 });
    expect(session.cards[0].item.character).toBe('あ');
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
