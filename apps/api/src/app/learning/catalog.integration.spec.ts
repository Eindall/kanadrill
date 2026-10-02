/**
 * Test d'intégration du catalogue « Apprendre » (vraie base PostgreSQL, migrations et seed réels).
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base,
 * ne la pointe jamais vers une base qui contient des données à garder.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import type { CatalogItemDto, ItemDetailDto } from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { SESSION_COOKIE } from '../auth/session';
import { SessionService } from '../auth/session.service';
import { User } from '../users/user.entity';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

(TEST_DATABASE_URL ? describe : describe.skip)('Catalogue « Apprendre »', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let base: string;
  let cookieA: string;
  let cookieB: string;

  const loginAs = async (userId: string) => `${SESSION_COOKIE}=${(await app.get(SessionService).issue(userId)).token}`;
  const call = (cookie: string | undefined, method: string, path: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const list = async (cookie: string) => (await (await call(cookie, 'GET', '/catalog')).json()) as CatalogItemDto[];
  const detail = async (cookie: string, id: string) => (await (await call(cookie, 'GET', `/catalog/${id}`)).json()) as ItemDetailDto;

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
    cookieA = await loginAs((await users.save({ username: 'alice', avatarUrl: null })).id);
    cookieB = await loginAs((await users.save({ username: 'bob', avatarUrl: null })).id);
  }, 60_000);

  afterAll(async () => app?.close());

  it('exige une session', async () => {
    expect((await call(undefined, 'GET', '/catalog')).status).toBe(401);
    expect((await call(undefined, 'GET', '/catalog/00000000-0000-4000-8000-000000000000')).status).toBe(401);
  });

  it('liste les 208 kana dans l\'ordre pédagogique, avec groupe et lecture, sans les tracés', async () => {
    const items = await list(cookieA);
    expect(items).toHaveLength(208);
    expect(items.slice(0, 3).map((item) => item.character)).toEqual(['あ', 'い', 'う']);
    expect(items[104].character).toBe('ア');
    expect(items.find((item) => item.character === 'し')).toMatchObject({ reading: 'shi', group: 'base', mastery: 'unseen' });
    expect(items.find((item) => item.character === 'ぱ')?.group).toBe('voiced');
    expect(items.find((item) => item.character === 'ギョ')).toMatchObject({ reading: 'gyo', group: 'yoon', type: 'katakana' });
    expect(items[0]).not.toHaveProperty('strokes');
  });

  it('renvoie la fiche d\'un kana avec ses traits', async () => {
    const id = (await list(cookieA)).find((item) => item.character === 'あ')!.id;
    const item = await detail(cookieA, id);
    expect(item).toMatchObject({ character: 'あ', readings: ['a'], mastery: 'unseen', reps: 0, lapses: 0, nextDue: null });
    expect(item.strokes).toHaveLength(3);
    expect(item.strokes[0].d).toMatch(/^M/);
  });

  it('répond 400 pour un identifiant mal formé et 404 pour un élément inconnu', async () => {
    expect((await call(cookieA, 'GET', '/catalog/pas-un-uuid')).status).toBe(400);
    expect((await call(cookieA, 'GET', '/catalog/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('reflète la maîtrise de chaque utilisateur, sans mélanger les comptes', async () => {
    const id = (await list(cookieA)).find((item) => item.character === 'あ')!.id;
    await call(cookieA, 'POST', '/reviews', { itemId: id, mode: 'choice', answer: 'a', durationMs: 3000 });

    const mine = (await list(cookieA)).find((item) => item.id === id)!;
    expect(mine.mastery).toBe('learning');
    expect((await list(cookieB)).find((item) => item.id === id)!.mastery).toBe('unseen');

    const card = await detail(cookieA, id);
    expect(card).toMatchObject({ reps: 1, lapses: 0 });
    expect(card.nextDue).not.toBeNull();
    expect((await detail(cookieB, id)).nextDue).toBeNull();
  });
});
