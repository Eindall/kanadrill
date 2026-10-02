/**
 * Test d'intégration des kanji : catalogue, dictionnaire perso, sessions et réponses (vraie base PostgreSQL,
 * migrations et seed réels, avec les 10 000 kanji).
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base,
 * ne la pointe jamais vers une base qui contient des données à garder.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import type {
  ItemDetailDto,
  KanjiLevelSummaryDto,
  KanjiPageDto,
  ReviewOverviewDto,
  ReviewResultDto,
  ReviewSessionDto,
} from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { SESSION_COOKIE } from '../auth/session';
import { SessionService } from '../auth/session.service';
import { User } from '../users/user.entity';
import { UserItem } from './user-item.entity';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

(TEST_DATABASE_URL ? describe : describe.skip)('Kanji : catalogue, dictionnaire, révisions', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let base: string;
  let cookieA: string;
  let cookieB: string;
  let userA: User;

  const loginAs = async (userId: string) => `${SESSION_COOKIE}=${(await app.get(SessionService).issue(userId)).token}`;
  const call = (cookie: string | undefined, method: string, path: string, body?: unknown) =>
    fetch(`${base}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(response: Response) => (await response.json()) as T;
  const list = async (cookie: string, query = '') => json<KanjiPageDto>(await call(cookie, 'GET', `/kanji${query}`));
  const levels = async (cookie: string) => json<KanjiLevelSummaryDto[]>(await call(cookie, 'GET', '/kanji/levels'));
  const idOf = async (character: string) => (await list(cookieA, `?q=${encodeURIComponent(character)}`)).items[0].id;
  const add = (cookie: string, itemIds: string[]) => call(cookie, 'POST', '/dictionary', { itemIds });
  const getSession = async (cookie: string, query: string) => json<ReviewSessionDto>(await call(cookie, 'GET', `/reviews/session?${query}`));
  const answer = (cookie: string, itemId: string, mode: string, text: string) =>
    call(cookie, 'POST', '/reviews', { itemId, mode, answer: text, durationMs: 3000 });

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
    cookieA = await loginAs(userA.id);
    cookieB = await loginAs((await users.save({ username: 'bob', avatarUrl: null })).id);
  }, 120_000);

  afterAll(async () => app?.close());

  it('exige une session', async () => {
    for (const [method, path] of [['GET', '/kanji'], ['GET', '/kanji/levels'], ['POST', '/dictionary'], ['DELETE', '/dictionary/00000000-0000-4000-8000-000000000000']]) {
      expect([method, path, (await call(undefined, method, path, method === 'POST' ? {} : undefined)).status]).toEqual([method, path, 401]);
    }
  });

  describe('catalogue', () => {
    it('résume les niveaux JLPT (N5 à N1 puis « autres »), avec le dictionnaire de l\'utilisateur', async () => {
      const summary = await levels(cookieA);
      expect(summary.map((level) => level.level)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1', 'other']);
      expect(summary[0].total).toBeGreaterThan(70);
      expect(summary[5].total).toBeGreaterThan(7000);
      expect(summary.every((level) => level.inDictionary === 0)).toBe(true);
    });

    it('liste un niveau dans l\'ordre pédagogique, avec le premier sens', async () => {
      const page = await list(cookieA, '?level=N5');
      expect(page.total).toBeGreaterThan(70);
      expect(page.items).toHaveLength(page.total); // un niveau N5 tient dans une page
      expect(page.items[0]).toMatchObject({ character: '日', meaning: 'jour', jlpt: 'N5', inDictionary: false, mastery: 'unseen' });
      expect(page.items.every((item) => item.jlpt === 'N5')).toBe(true);
    });

    it('pagine, et la catégorie « autres » ne contient que des kanji hors JLPT', async () => {
      const first = await list(cookieA, '?level=other&limit=10');
      const second = await list(cookieA, '?level=other&limit=10&offset=10');
      expect(first.items).toHaveLength(10);
      expect(first.total).toBeGreaterThan(7000);
      expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(20);
      expect(first.items.every((item) => item.jlpt === null)).toBe(true);
    });

    it('cherche par caractères, par sens ou par lecture', async () => {
      expect((await list(cookieA, `?q=${encodeURIComponent('日本')}`)).items.map((item) => item.character).sort()).toEqual(['日', '本']);
      expect((await list(cookieA, '?q=soleil')).items.map((item) => item.character)).toContain('日');
      expect((await list(cookieA, '?q=nichi')).items.map((item) => item.character)).toContain('日');
      expect((await list(cookieA, '?q=a%25b_c')).total).toBe(0); // les jokers de LIKE sont neutralisés
      expect((await list(cookieA, `?level=N4&q=${encodeURIComponent('日')}`)).total).toBe(0); // 日 est N5
    });

    it('valide les paramètres', async () => {
      for (const query of ['?level=N9', '?limit=500', '?limit=0', '?offset=-1', '?foo=1']) {
        expect([query, (await call(cookieA, 'GET', `/kanji${query}`)).status]).toEqual([query, 400]);
      }
    });

    it('renvoie la fiche d\'un kanji : lectures on et kun, sens, niveau, tracés', async () => {
      const item = await json<ItemDetailDto>(await call(cookieA, 'GET', `/catalog/${await idOf('日')}`));
      expect(item).toMatchObject({ type: 'kanji', character: '日', meanings: expect.arrayContaining(['jour', 'soleil']) });
      expect(item.kanji).toMatchObject({ on: ['ニチ', 'ジツ'], jlpt: 'N5', grade: 1, strokeCount: 4, language: 'fr', inDictionary: false });
      expect(item.kanji?.kun[0]).toBe('ひ');
      expect(item.strokes).toHaveLength(4);
    });
  });

  describe('dictionnaire', () => {
    it('ajoute des kanji (sans doublon), ignore les kana, valide les entrées', async () => {
      const id = await idOf('日');
      expect(await json(await add(cookieA, [id]))).toEqual({ added: 1 });
      expect(await json(await add(cookieA, [id]))).toEqual({ added: 0 }); // déjà dedans
      const kana = (await dataSource.query(`SELECT id FROM items WHERE type = 'hiragana' LIMIT 1`))[0].id;
      expect(await json(await add(cookieA, [kana]))).toEqual({ added: 0 }); // les kana y sont d'office
      expect((await add(cookieA, [])).status).toBe(400);
      expect((await add(cookieA, ['pas-un-uuid'])).status).toBe(400);
      expect((await add(cookieA, Array(501).fill(id))).status).toBe(400);
      const state = await dataSource.getRepository(UserItem).findOneByOrFail({ userId: userA.id, itemId: id });
      expect(state).toMatchObject({ state: 0, reps: 0 }); // carte neuve
    });

    it('ajoute tout un niveau et le reflète dans le catalogue, sans toucher aux autres comptes', async () => {
      const result = await json<{ added: number }>(await call(cookieA, 'POST', '/dictionary/levels/N5'));
      expect(result.added).toBe((await levels(cookieA))[0].total - 1); // 日 était déjà ajouté
      expect((await levels(cookieA))[0].inDictionary).toBe((await levels(cookieA))[0].total);
      expect((await list(cookieA, '?level=N5')).items.every((item) => item.inDictionary)).toBe(true);
      expect((await levels(cookieB))[0].inDictionary).toBe(0);
      expect((await call(cookieA, 'POST', '/dictionary/levels/N9')).status).toBe(400);
    });

    it('retire un kanji du dictionnaire', async () => {
      const id = await idOf('日');
      expect((await call(cookieA, 'DELETE', `/dictionary/${id}`)).status).toBe(204);
      expect((await call(cookieA, 'DELETE', `/dictionary/${id}`)).status).toBe(404);
      const item = await json<ItemDetailDto>(await call(cookieA, 'GET', `/catalog/${id}`));
      expect(item.kanji?.inDictionary).toBe(false);
      expect((await call(cookieA, 'DELETE', '/dictionary/pas-un-uuid')).status).toBe(400);
      await add(cookieA, [id]);
    });
  });

  describe('sessions et réponses', () => {
    it('n\'a aucune carte de kanji quand le dictionnaire est vide', async () => {
      expect((await call(cookieB, 'GET', '/reviews/session?count=15&types=kanji&modes=meaning')).status).toBe(400);
      expect(((await json<ReviewOverviewDto>(await call(cookieB, 'GET', '/reviews/overview'))).available.kanji)).toEqual({ total: 0, due: 0 });
    });

    it('propose les kanji du dictionnaire : sens en QCM, lecture en saisie, tracé avec modèle', async () => {
      const session = await getSession(cookieA, 'count=50&types=kanji&modes=meaning,reading,drawing');
      expect(session.cards.length).toBe(50);
      expect(session.cards.every((card) => card.item.type === 'kanji' && card.item.kanji !== undefined)).toBe(true);
      expect(new Set(session.cards.map((card) => card.mode))).toEqual(new Set(['meaning', 'reading', 'drawing']));
      for (const card of session.cards) {
        if (card.mode === 'meaning') {
          expect(card.choices).toHaveLength(4);
          expect(card.choices).toContain(card.item.meanings[0]);
        } else {
          expect(card.choices).toBeUndefined();
        }
        expect((card.mode === 'drawing') === ((card.strokes?.length ?? 0) > 0)).toBe(true);
      }
      const overview = await json<ReviewOverviewDto>(await call(cookieA, 'GET', '/reviews/overview'));
      expect(overview.available.kanji?.total).toBeGreaterThan(70);
    });

    it('mélange kana et kanji, chacun avec les exercices de sa famille', async () => {
      const session = await getSession(cookieA, 'count=50&types=hiragana,kanji&modes=choice,meaning');
      const kana = session.cards.filter((card) => card.item.type === 'hiragana');
      const kanji = session.cards.filter((card) => card.item.type === 'kanji');
      expect(kana.length).toBeGreaterThan(0);
      expect(kanji.length).toBeGreaterThan(0);
      expect(kana.every((card) => card.mode === 'choice')).toBe(true);
      expect(kanji.every((card) => card.mode === 'meaning')).toBe(true);
    });

    it('propose le QCM inversé d\'un kanji : le bon kanji parmi quatre, du même niveau JLPT, sans sens partagé', async () => {
      const session = await getSession(cookieA, 'count=50&types=kanji&modes=kanjiReverse');
      expect(session.cards.every((card) => card.mode === 'kanjiReverse' && card.choices?.length === 4)).toBe(true);
      const levels = await dataSource.query(`SELECT character, coalesce(metadata ->> 'jlpt', 'other') AS level, meanings FROM items WHERE type = 'kanji'`);
      const byChar = new Map<string, { level: string; meanings: string[] }>(levels.map((row: { character: string; level: string; meanings: string[] }) => [row.character, row]));
      for (const card of session.cards) {
        expect(card.choices).toContain(card.item.character);
        const mine = byChar.get(card.item.character)!;
        for (const choice of card.choices!.filter((c) => c !== card.item.character)) {
          const other = byChar.get(choice)!;
          expect(other.level).toBe(mine.level); // 79 kanji N5 : assez de leurres du même niveau
          expect(other.meanings.some((m) => mine.meanings.map((x) => x.toLowerCase()).includes(m.toLowerCase()))).toBe(false);
        }
      }
    });

    it('ne mélange pas les QCM inversés : celui des kanji ne s\'applique pas aux kana, ni l\'inverse', async () => {
      const mixed = await getSession(cookieA, 'count=50&types=hiragana,kanji&modes=reverse,kanjiReverse');
      expect(mixed.cards.filter((card) => card.item.type === 'hiragana').every((card) => card.mode === 'reverse')).toBe(true);
      expect(mixed.cards.filter((card) => card.item.type === 'kanji').every((card) => card.mode === 'kanjiReverse')).toBe(true);
      const kanjiId = await idOf('日');
      expect((await answer(cookieA, kanjiId, 'reverse', '日')).status).toBe(400); // exercice de kana sur un kanji
    });

    it('corrige le QCM inversé d\'un kanji', async () => {
      const id = await idOf('日');
      expect(await json<ReviewResultDto>(await answer(cookieA, id, 'kanjiReverse', '日'))).toMatchObject({ correct: true, expected: '日' });
      expect(await json<ReviewResultDto>(await answer(cookieA, id, 'kanjiReverse', '月'))).toMatchObject({ correct: false, expected: '日' });
    });

    it('retombe sur le sens quand un réglage « kana » ne convient pas aux kanji', async () => {
      const session = await getSession(cookieA, 'count=15&types=kanji&modes=choice,typing');
      expect(session.cards.every((card) => card.mode === 'meaning')).toBe(true);
    });

    it('corrige le sens, la lecture en romaji ou en kana, et donne la bonne réponse', async () => {
      const id = await idOf('日');
      const result = async (mode: string, text: string) => json<ReviewResultDto>(await answer(cookieA, id, mode, text));
      expect(await result('meaning', 'Jour')).toMatchObject({ correct: true });
      expect(await result('meaning', 'lune')).toMatchObject({ correct: false, expected: expect.stringContaining('jour') });
      expect(await result('reading', 'nichi')).toMatchObject({ correct: true });
      expect(await result('reading', 'にち')).toMatchObject({ correct: true }); // hiragana
      expect(await result('reading', 'ジツ')).toMatchObject({ correct: true }); // katakana, autre lecture
      expect(await result('reading', 'ひ')).toMatchObject({ correct: true }); // kun
      expect(await result('reading', 'tsuki')).toMatchObject({ correct: false, expected: expect.stringContaining('ニチ') });
      expect(await result('drawing', 'correct')).toMatchObject({ correct: true });
    });

    it('refuse un exercice qui ne convient pas, ou un kanji hors du dictionnaire', async () => {
      const id = await idOf('日');
      expect((await answer(cookieA, id, 'choice', 'nichi')).status).toBe(400); // exercice de kana
      const kana = (await dataSource.query(`SELECT id FROM items WHERE type = 'hiragana' LIMIT 1`))[0].id;
      expect((await answer(cookieA, kana, 'meaning', 'a')).status).toBe(400); // exercice de kanji
      expect((await answer(cookieB, id, 'meaning', 'jour')).status).toBe(400); // pas dans le dictionnaire de bob
    });
  });
});
