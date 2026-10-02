/**
 * Test d'intégration du schéma d'apprentissage et du seed (vraie base PostgreSQL, migrations réelles).
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide les tables `users` et `items`
 * de cette base, ne la pointe jamais vers une base qui contient des données à garder.
 */
import { Test } from '@nestjs/testing';
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { applyCard, toCard } from './fsrs-card';
import { Item } from './item.entity';
import { ReviewLog } from './review-log.entity';
import { seedItems } from './seed/seed-items';
import { UserItem } from './user-item.entity';
import { User } from '../users/user.entity';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

(TEST_DATABASE_URL ? describe : describe.skip)('Schéma d\'apprentissage et seed', () => {
  // Un seed complet (10 000 kanji et leurs tracés) prend de l'ordre de 2 s : plusieurs seeds dans un test dépassent les 5 s par défaut.
  jest.setTimeout(60_000);
  let dataSource: DataSource;
  let close: () => Promise<void>;

  const countKana = async () => (await countItems('hiragana')) + (await countItems('katakana'));
  const countItems = (type: string) => dataSource.getRepository(Item).countBy({ type: type as Item['type'] });
  const newUser = () => dataSource.getRepository(User).save({ username: 'tester', avatarUrl: null });
  const getItem = (character: string) => dataSource.getRepository(Item).findOneByOrFail({ character });

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-test-secret-test-secret-test',
      APP_URL: 'http://localhost:4200',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_REDIRECT_URI: 'http://localhost:4200/api/auth/discord/callback',
    });
    // Le démarrage de l'application applique les migrations puis le seed (OnApplicationBootstrap).
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    close = () => app.close();
    assertTestDatabase(dataSource); // jamais la base du .env
    await dataSource.query('TRUNCATE users CASCADE');
  }, 60_000);

  afterAll(async () => close?.());

  it('charge automatiquement les kana au démarrage', async () => {
    expect(await countItems('hiragana')).toBe(104);
    expect(await countItems('katakana')).toBe(104);
    const shi = await getItem('し');
    expect(shi).toMatchObject({ type: 'hiragana', readings: ['shi', 'si'], meanings: [] });
    expect((await getItem('キャ')).readings).toEqual(['kya']);
  });

  it('est idempotent : un second seed ne crée aucun doublon', async () => {
    await seedItems(dataSource);
    await seedItems(dataSource);
    expect(await countKana()).toBe(208);
  });

  it('corrige les lectures modifiées et conserve les identifiants', async () => {
    const before = await getItem('し');
    await dataSource.getRepository(Item).update(before.id, { readings: ['faux'] });
    await seedItems(dataSource);
    const after = await getItem('し');
    expect(after.readings).toEqual(['shi', 'si']);
    expect(after.id).toBe(before.id);
  });

  it('refuse un doublon (type, caractère) et un type inconnu', async () => {
    const repo = dataSource.getRepository(Item);
    await expect(repo.insert({ type: 'hiragana', character: 'あ', readings: ['a'] })).rejects.toThrow();
    await expect(repo.insert({ type: 'emoji' as never, character: 'x', readings: ['x'] })).rejects.toThrow();
  });

  it('stocke l\'état FSRS, compatible ts-fsrs, unique par (utilisateur, item)', async () => {
    const user = await newUser();
    const item = await getItem('あ');
    const repo = dataSource.getRepository(UserItem);

    // Les valeurs par défaut de la base correspondent à createEmptyCard().
    const saved = await repo.save({ userId: user.id, itemId: item.id });
    let userItem = await repo.findOneByOrFail({ id: saved.id });
    const empty = createEmptyCard();
    expect(toCard(userItem)).toMatchObject({
      stability: empty.stability,
      difficulty: empty.difficulty,
      reps: 0,
      lapses: 0,
      state: empty.state,
      scheduled_days: 0,
    });

    // Une révision : la carte reconstruite passe dans ts-fsrs et le résultat se sauvegarde.
    const now = new Date();
    const { card, log } = fsrs().next(toCard(userItem), now, Rating.Good);
    applyCard(userItem, card);
    await repo.save(userItem);
    userItem = await repo.findOneByOrFail({ id: saved.id });
    expect(userItem.reps).toBe(1);
    expect(userItem.stability).toBeCloseTo(card.stability);
    expect(userItem.due.getTime()).toBe(card.due.getTime());
    expect(userItem.lastReview?.getTime()).toBe(now.getTime());
    // Et la carte relue est de nouveau exploitable par ts-fsrs.
    expect(() => fsrs().next(toCard(userItem), new Date(now.getTime() + 86_400_000), Rating.Easy)).not.toThrow();

    await expect(repo.insert({ userId: user.id, itemId: item.id })).rejects.toThrow();

    // ReviewLog : snapshot FSRS avant la réponse.
    const logs = dataSource.getRepository(ReviewLog);
    await logs.save({
      userId: user.id,
      itemId: item.id,
      rating: Rating.Good,
      durationMs: 1500,
      state: log.state,
      due: log.due,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      lastElapsedDays: log.last_elapsed_days,
      scheduledDays: log.scheduled_days,
      learningSteps: log.learning_steps,
    });
    expect(await logs.countBy({ userId: user.id })).toBe(1);
    await expect(
      logs.insert({ ...(await logs.findOneByOrFail({ userId: user.id })), id: undefined, rating: 5 as never }),
    ).rejects.toThrow();
  });

  it('survit au re-seed et disparaît avec le compte (cascade)', async () => {
    const user = await dataSource.getRepository(User).findOneByOrFail({ username: 'tester' });
    await seedItems(dataSource);
    expect(await dataSource.getRepository(UserItem).countBy({ userId: user.id })).toBe(1);
    expect(await countKana()).toBe(208);

    await dataSource.getRepository(User).delete(user.id);
    expect(await dataSource.getRepository(UserItem).countBy({ userId: user.id })).toBe(0);
    expect(await dataSource.getRepository(ReviewLog).countBy({ userId: user.id })).toBe(0);
    expect(await countKana()).toBe(208);
  });
});
