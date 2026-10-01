/**
 * Test d'intégration des sessions (vraie base PostgreSQL) : déconnexion réelle, révocation, expiration glissante,
 * liste des appareils, plafond, nettoyage.
 *
 * Ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base.
 */
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import type { SessionInfoDto } from '@kanadrill/shared';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { User } from '../users/user.entity';
import { AuthSession } from './auth-session.entity';
import {
  MAX_ACTIVE_SESSIONS,
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_COOKIE,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './session';
import { SessionCleanupService } from './session-cleanup.service';
import { SessionService } from './session.service';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CHROME_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

(TEST_DATABASE_URL ? describe : describe.skip)('Sessions', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let sessions: SessionService;
  let jwt: JwtService;
  let base: string;
  let alice: User;
  let bob: User;

  interface Login {
    cookie: string;
    token: string;
    id: string;
  }
  const loginAs = async (userId: string, userAgent?: string): Promise<Login> => {
    const { token, session } = await sessions.issue(userId, userAgent);
    return { cookie: `${SESSION_COOKIE}=${token}`, token, id: session.id };
  };
  const call = (cookie: string | undefined, method: string, path: string) =>
    fetch(`${base}/api${path}`, { method, headers: cookie ? { cookie } : {} });
  const me = (login: Login) => call(login.cookie, 'GET', '/users/me');
  const row = (id: string) => dataSource.getRepository(AuthSession).findOneByOrFail({ id });
  const sessionCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  const maxAge = (setCookie: string) => Number(/Max-Age=(\d+)/.exec(setCookie)?.[1]);

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
    sessions = app.get(SessionService);
    jwt = app.get(JwtService);
    assertTestDatabase(dataSource); // jamais la base du .env
    await dataSource.query('TRUNCATE users CASCADE');
    alice = await dataSource.getRepository(User).save({ username: 'alice', avatarUrl: null });
    bob = await dataSource.getRepository(User).save({ username: 'bob', avatarUrl: null });
  }, 60_000);

  afterAll(async () => app?.close());

  describe('ouverture et déconnexion', () => {
    it('une session ouverte donne accès, et mémorise l\'appareil (tronqué)', async () => {
      const login = await loginAs(alice.id, 'x'.repeat(500));
      expect((await me(login)).status).toBe(200);
      const stored = await row(login.id);
      expect(stored.userAgent).toHaveLength(256);
      expect(stored.revokedAt).toBeNull();
      expect(stored.expiresAt.getTime() - stored.lastUsedAt.getTime()).toBe(SESSION_IDLE_TTL_MS);
    });

    it('la déconnexion révoque vraiment : le cookie rejoué ensuite est refusé', async () => {
      const login = await loginAs(alice.id);
      expect((await me(login)).status).toBe(200);

      const res = await call(login.cookie, 'POST', '/auth/logout');
      expect(res.status).toBe(204);
      expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/); // cookie effacé

      expect((await row(login.id)).revokedAt).not.toBeNull();
      expect((await me(login)).status).toBe(401); // le jeton volé ne sert plus
    });

    it('la déconnexion ne plante pas sans cookie, avec un jeton invalide ou déjà révoqué', async () => {
      expect((await call(undefined, 'POST', '/auth/logout')).status).toBe(204);
      expect((await call(`${SESSION_COOKIE}=n-importe-quoi`, 'POST', '/auth/logout')).status).toBe(204);
      const login = await loginAs(alice.id);
      await call(login.cookie, 'POST', '/auth/logout');
      expect((await call(login.cookie, 'POST', '/auth/logout')).status).toBe(204);
    });

    it('un jeton ne peut pas révoquer la session d\'un autre en changeant de sujet', async () => {
      const victim = await loginAs(alice.id);
      const forged = await jwt.signAsync({ sub: bob.id }, { jwtid: victim.id });
      await call(`${SESSION_COOKIE}=${forged}`, 'POST', '/auth/logout');
      expect((await row(victim.id)).revokedAt).toBeNull();
    });
  });

  describe('jetons refusés', () => {
    it('refuse sans cookie, avec un jeton illisible ou signé avec un autre secret', async () => {
      expect((await call(undefined, 'GET', '/users/me')).status).toBe(401);
      expect((await call(`${SESSION_COOKIE}=abc`, 'GET', '/users/me')).status).toBe(401);
      const foreign = await new JwtService({ secret: 'un-autre-secret-un-autre-secret-xxxxx' }).signAsync(
        { sub: alice.id },
        { jwtid: (await loginAs(alice.id)).id },
      );
      expect((await call(`${SESSION_COOKIE}=${foreign}`, 'GET', '/users/me')).status).toBe(401);
    });

    it('refuse un jeton d\'ancien format (sans jti), un jti inconnu ou qui n\'est pas un UUID', async () => {
      const old = await jwt.signAsync({ sub: alice.id });
      expect((await call(`${SESSION_COOKIE}=${old}`, 'GET', '/users/me')).status).toBe(401);
      const unknown = await jwt.signAsync({ sub: alice.id }, { jwtid: '00000000-0000-4000-8000-000000000000' });
      expect((await call(`${SESSION_COOKIE}=${unknown}`, 'GET', '/users/me')).status).toBe(401);
      const notUuid = await jwt.signAsync({ sub: alice.id }, { jwtid: 'pas-un-uuid' });
      expect((await call(`${SESSION_COOKIE}=${notUuid}`, 'GET', '/users/me')).status).toBe(401);
    });

    it('refuse un jeton dont le jti est celui d\'une session d\'un autre utilisateur', async () => {
      const bobs = await loginAs(bob.id);
      const forged = await jwt.signAsync({ sub: alice.id }, { jwtid: bobs.id });
      expect((await call(`${SESSION_COOKIE}=${forged}`, 'GET', '/users/me')).status).toBe(401);
    });

    it('refuse une session expirée ou révoquée', async () => {
      const expired = await loginAs(alice.id);
      await dataSource.query(`UPDATE auth_sessions SET expires_at = now() - interval '1 second' WHERE id = $1`, [expired.id]);
      expect((await me(expired)).status).toBe(401);

      const revoked = await loginAs(alice.id);
      await dataSource.query(`UPDATE auth_sessions SET revoked_at = now() WHERE id = $1`, [revoked.id]);
      expect((await me(revoked)).status).toBe(401);
    });

    it('la suppression du compte supprime ses sessions : le cookie ne sert plus', async () => {
      const carol = await dataSource.getRepository(User).save({ username: 'carol', avatarUrl: null });
      const login = await loginAs(carol.id);
      expect((await call(login.cookie, 'DELETE', '/users/me')).status).toBe(204);
      expect(await dataSource.getRepository(AuthSession).countBy({ userId: carol.id })).toBe(0);
      expect((await me(login)).status).toBe(401);
    });
  });

  describe('expiration glissante', () => {
    it('prolonge la session à l\'usage et réémet le cookie avec la nouvelle durée', async () => {
      const login = await loginAs(alice.id);
      await dataSource.query(
        `UPDATE auth_sessions SET last_used_at = now() - interval '1 hour', expires_at = now() + interval '10 hours' WHERE id = $1`,
        [login.id],
      );
      const before = Date.now();
      const res = await me(login);
      expect(res.status).toBe(200);

      const stored = await row(login.id);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(before + SESSION_IDLE_TTL_MS - 5_000);
      expect(stored.lastUsedAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
      const cookie = sessionCookie(res);
      expect(cookie).toContain(login.token); // même jeton, nouvelle durée de vie du cookie
      expect(maxAge(cookie as string)).toBeGreaterThan(SESSION_IDLE_TTL_MS / 1000 - 10);
      expect(maxAge(cookie as string)).toBeLessThanOrEqual(SESSION_IDLE_TTL_MS / 1000);
    });

    it('ne réécrit rien (ni cookie) si la session a été utilisée il y a moins de 10 minutes', async () => {
      const login = await loginAs(alice.id);
      const before = await row(login.id);
      const res = await me(login);
      expect(res.status).toBe(200);
      expect(sessionCookie(res)).toBeUndefined();
      expect((await row(login.id)).lastUsedAt.getTime()).toBe(before.lastUsedAt.getTime());
      expect(SESSION_TOUCH_INTERVAL_MS).toBe(10 * 60 * 1000);
    });

    it('une session inutilisée plus de 48 h expire', async () => {
      const login = await loginAs(alice.id);
      await dataSource.query(
        `UPDATE auth_sessions SET last_used_at = now() - interval '49 hours', expires_at = now() - interval '1 hour' WHERE id = $1`,
        [login.id],
      );
      expect((await me(login)).status).toBe(401);
    });

    it('ne dépasse jamais le plafond absolu de 30 jours, même utilisée tous les jours', async () => {
      const login = await loginAs(alice.id);
      // Ouverte il y a 29 jours et 23 h : il ne reste qu'une heure avant le plafond.
      await dataSource.query(
        `UPDATE auth_sessions SET created_at = now() - interval '29 days 23 hours', last_used_at = now() - interval '1 hour',
                expires_at = now() + interval '40 hours' WHERE id = $1`,
        [login.id],
      );
      const res = await me(login);
      expect(res.status).toBe(200);

      const stored = await row(login.id);
      const cap = stored.createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS;
      expect(stored.expiresAt.getTime()).toBe(cap);
      expect(stored.expiresAt.getTime()).toBeLessThan(Date.now() + 2 * HOUR);
      expect(maxAge(sessionCookie(res) as string)).toBeLessThanOrEqual(3_600);
    });
  });

  describe('appareils connectés', () => {
    it('liste les sessions actives (appareil lisible, session courante signalée), les plus récentes d\'abord', async () => {
      const dave = await dataSource.getRepository(User).save({ username: 'dave', avatarUrl: null });
      const desktop = await loginAs(dave.id, CHROME_LINUX);
      const phone = await loginAs(dave.id, SAFARI_IOS);
      // L'appareil courant a servi à l'instant (pas de prolongation par cette requête) ; le téléphone, il y a 5 h.
      await dataSource.query(`UPDATE auth_sessions SET last_used_at = now() - interval '1 minute' WHERE id = $1`, [desktop.id]);
      await dataSource.query(`UPDATE auth_sessions SET last_used_at = now() - interval '5 hours' WHERE id = $1`, [phone.id]);
      // Une session révoquée et une expirée ne sont pas listées.
      const gone = await loginAs(dave.id);
      await dataSource.query(`UPDATE auth_sessions SET revoked_at = now() WHERE id = $1`, [gone.id]);
      const stale = await loginAs(dave.id);
      await dataSource.query(`UPDATE auth_sessions SET expires_at = now() - interval '1 hour' WHERE id = $1`, [stale.id]);

      const list = (await (await call(desktop.cookie, 'GET', '/users/me/sessions')).json()) as SessionInfoDto[];
      expect(list.map((s) => s.id)).toEqual([desktop.id, phone.id]);
      expect(list.map((s) => s.device)).toEqual(['Chrome sur Linux', 'Safari sur iOS']);
      expect(list.map((s) => s.current)).toEqual([true, false]);
      expect(Object.keys(list[0]).sort()).toEqual(['createdAt', 'current', 'device', 'id', 'lastUsedAt']);
    });

    it('déconnecte un autre appareil sans toucher à la session courante', async () => {
      const current = await loginAs(alice.id);
      const other = await loginAs(alice.id);
      expect((await call(current.cookie, 'DELETE', `/users/me/sessions/${other.id}`)).status).toBe(204);
      expect((await me(other)).status).toBe(401);
      expect((await me(current)).status).toBe(200);
      // Déjà révoquée : introuvable.
      expect((await call(current.cookie, 'DELETE', `/users/me/sessions/${other.id}`)).status).toBe(404);
    });

    it('déconnecter l\'appareil courant efface aussi son cookie', async () => {
      const login = await loginAs(alice.id);
      const res = await call(login.cookie, 'DELETE', `/users/me/sessions/${login.id}`);
      expect(res.status).toBe(204);
      expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect((await me(login)).status).toBe(401);
    });

    it('n\'atteint jamais la session d\'un autre utilisateur (404) et refuse un identifiant invalide', async () => {
      const mine = await loginAs(alice.id);
      const bobs = await loginAs(bob.id);
      expect((await call(mine.cookie, 'DELETE', `/users/me/sessions/${bobs.id}`)).status).toBe(404);
      expect((await me(bobs)).status).toBe(200);
      expect((await call(mine.cookie, 'DELETE', '/users/me/sessions/pas-un-uuid')).status).toBe(404);
      expect((await call(undefined, 'DELETE', `/users/me/sessions/${bobs.id}`)).status).toBe(401);
    });

    it('déconnecte tous les autres appareils, et seulement ceux de l\'utilisateur', async () => {
      const erin = await dataSource.getRepository(User).save({ username: 'erin', avatarUrl: null });
      const current = await loginAs(erin.id);
      const others = [await loginAs(erin.id), await loginAs(erin.id)];
      const strangers = await loginAs(bob.id);

      expect((await call(current.cookie, 'DELETE', '/users/me/sessions')).status).toBe(204);
      for (const other of others) expect((await me(other)).status).toBe(401);
      expect((await me(current)).status).toBe(200);
      expect((await me(strangers)).status).toBe(200);
      const list = (await (await call(current.cookie, 'GET', '/users/me/sessions')).json()) as SessionInfoDto[];
      expect(list).toHaveLength(1);
      expect(list[0].current).toBe(true);
    });
  });

  describe('plafond et nettoyage', () => {
    it(`limite à ${MAX_ACTIVE_SESSIONS} sessions actives : la plus ancienne est révoquée à la suivante`, async () => {
      const frank = await dataSource.getRepository(User).save({ username: 'frank', avatarUrl: null });
      const logins: Login[] = [];
      for (let i = 0; i < MAX_ACTIVE_SESSIONS + 2; i++) logins.push(await loginAs(frank.id));

      const activeIds = (await dataSource.query(`SELECT id FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL`, [frank.id])) as Array<{ id: string }>;
      expect(activeIds).toHaveLength(MAX_ACTIVE_SESSIONS);

      expect((await me(logins[0])).status).toBe(401);
      expect((await me(logins[1])).status).toBe(401);
      expect((await me(logins[2])).status).toBe(200);
      expect((await me(logins[logins.length - 1])).status).toBe(200);
    });

    it('le nettoyage supprime les sessions expirées et les révoquées depuis longtemps, rien d\'autre', async () => {
      const grace = await dataSource.getRepository(User).save({ username: 'grace', avatarUrl: null });
      const active = await loginAs(grace.id);
      const expired = await loginAs(grace.id);
      const revokedLongAgo = await loginAs(grace.id);
      const revokedRecently = await loginAs(grace.id);
      await dataSource.query(`UPDATE auth_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1`, [expired.id]);
      await dataSource.query(`UPDATE auth_sessions SET revoked_at = now() - interval '8 days' WHERE id = $1`, [revokedLongAgo.id]);
      await dataSource.query(`UPDATE auth_sessions SET revoked_at = now() - interval '1 day' WHERE id = $1`, [revokedRecently.id]);

      expect(await app.get(SessionCleanupService).run()).toBeGreaterThanOrEqual(2);

      const remaining = (await dataSource.query(`SELECT id FROM auth_sessions WHERE user_id = $1`, [grace.id])) as Array<{ id: string }>;
      expect(remaining.map((r) => r.id).sort()).toEqual([active.id, revokedRecently.id].sort());
    });
  });
});
