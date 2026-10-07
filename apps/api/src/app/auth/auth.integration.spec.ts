/**
 * Test d'intégration du parcours d'authentification (OAuth Discord simulé, vraie base PostgreSQL).
 *
 * Il est ignoré tant que TEST_DATABASE_URL n'est pas défini. ATTENTION : il vide la table `users` de cette base,
 * ne la pointe jamais vers une base qui contient des données à garder.
 *
 *   TEST_DATABASE_URL=postgres://kanadrill:motdepasse@127.0.0.1:5432/kanadrill_test npx nx test api
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { assertTestDatabase } from '../testing/assert-test-database';
import { DiscordStrategy } from './discord.strategy';
import { GoogleStrategy } from './google.strategy';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const APP_URL = 'http://localhost:4200';

(TEST_DATABASE_URL ? describe : describe.skip)('Authentification (Discord et Google)', () => {
  let app: NestExpressApplication;
  let base: string;
  let failExchange = false;
  let discordUser: Record<string, unknown> = {};
  let googleUser: Record<string, unknown> = {};
  const resetUsers = () => {
    discordUser = { id: '123456789012345678', username: 'thomas', global_name: 'Thomas', avatar: null, email: 'Thomas@Example.com', verified: true };
    googleUser = { sub: 'g-1001', name: 'Thomas G', picture: 'https://lh3.googleusercontent.com/a/x', email: ' thomas@example.com', email_verified: true };
  };
  resetUsers();

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-test-secret-test-secret-test',
      APP_URL,
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_REDIRECT_URI: `${APP_URL}/api/auth/discord/callback`,
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      GOOGLE_REDIRECT_URI: `${APP_URL}/api/auth/google/callback`,
      EMAIL_HASH_KEY: 'test-email-hash-key-test-email-hash-key',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');

    // On remplace les appels réseau vers Discord par des réponses simulées.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oauth2 = (app.get(DiscordStrategy) as any)._oauth2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oauth2.getOAuthAccessToken = (code: string, _params: unknown, cb: any) =>
      failExchange ? cb({ statusCode: 400, data: 'invalid_grant' }) : cb(null, `token-${code}`, 'refresh', {});
    // Le profil est récupéré par DiscordStrategy.userProfile (via `fetch`, plus via `_oauth2.get`).
    // Les profils simulés sont modifiables d'un test à l'autre (e-mail vérifié ou non, identité…).
    app.get(DiscordStrategy).userProfile = (_token, done) => done(null, discordUser);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const googleOauth2 = (app.get(GoogleStrategy) as any)._oauth2;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    googleOauth2.getOAuthAccessToken = (code: string, _params: unknown, cb: any) => cb(null, `token-${code}`, 'refresh', {});
    app.get(GoogleStrategy).userProfile = (_token, done) => done(null, googleUser);

    assertTestDatabase(app.get(DataSource)); // jamais la base du .env
    await app.get(DataSource).query('TRUNCATE users CASCADE');
  }, 60_000);

  afterAll(async () => app?.close());

  beforeEach(async () => {
    resetUsers();
    await app.get(DataSource).query('TRUNCATE users CASCADE');
  });

  const getCookie = (res: Response, name: string) =>
    res.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`))?.split(';')[0];

  it('refuse les routes protégées sans session', async () => {
    expect((await fetch(`${base}/api/users/me`)).status).toBe(401);
  });

  it('redirige vers Discord avec un state aléatoire gardé en cookie', async () => {
    const res = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') as string);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify email');
    expect(location.searchParams.get('prompt')).toBe('none');
    // Le cookie est un jeton signé qui contient le state, pas le state en clair.
    const stateCookie = getCookie(res, 'kd_oauth_state') as string;
    const payload = JSON.parse(Buffer.from(stateCookie.split('.')[1], 'base64url').toString());
    expect(payload).toMatchObject({ state: location.searchParams.get('state'), provider: 'discord', mode: 'login' });
  });

  it('renvoie vers /login si le state est absent, faux, ou si Discord ne fournit pas de code', async () => {
    const start = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
    const state = new URL(start.headers.get('location') as string).searchParams.get('state');
    const cookie = getCookie(start, 'kd_oauth_state') as string;
    const callback = (query: string, withCookie = true) =>
      fetch(`${base}/api/auth/discord/callback?${query}`, {
        redirect: 'manual',
        headers: withCookie ? { cookie } : {},
      });

    expect((await callback(`code=abc&state=${state}`, false)).headers.get('location')).toBe(`${APP_URL}/login?error=state`);
    expect((await callback('code=abc&state=faux')).headers.get('location')).toBe(`${APP_URL}/login?error=state`);
    expect((await callback(`state=${state}`)).headers.get('location')).toBe(`${APP_URL}/login?error=discord`);

    failExchange = true;
    expect((await callback(`code=abc&state=${state}`)).headers.get('location')).toBe(`${APP_URL}/login?error=discord`);
    failExchange = false;
  });

  it('crée le compte à la première connexion, le retrouve à la suivante, et gère le profil', async () => {
    const login = async () => {
      const start = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
      const state = new URL(start.headers.get('location') as string).searchParams.get('state');
      const res = await fetch(`${base}/api/auth/discord/callback?code=abc&state=${state}`, {
        redirect: 'manual',
        headers: { cookie: getCookie(start, 'kd_oauth_state') as string },
      });
      expect(res.headers.get('location')).toBe(`${APP_URL}/`);
      const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('kd_session=')) as string;
      expect(setCookie).toContain('HttpOnly');
      // Cookie à durée glissante : 48 h sans usage (et non plus 30 jours d'office).
      expect(Number(/Max-Age=(\d+)/.exec(setCookie)?.[1])).toBeGreaterThan(172_790);
      expect(Number(/Max-Age=(\d+)/.exec(setCookie)?.[1])).toBeLessThanOrEqual(172_800);
      return getCookie(res, 'kd_session') as string;
    };

    const session = await login();
    const me = await (await fetch(`${base}/api/users/me`, { headers: { cookie: session } })).json();
    expect(me.username).toBe('Thomas');
    expect(me.identities).toHaveLength(1);

    // Deuxième connexion : même compte, pas de doublon.
    const secondSession = await login();
    const meAgain = await (await fetch(`${base}/api/users/me`, { headers: { cookie: secondSession } })).json();
    expect(meAgain.id).toBe(me.id);
    expect((await app.get(DataSource).query('SELECT count(*) FROM users'))[0].count).toBe('1');
    // Chaque connexion ouvre sa propre session en base (un appareil = une ligne).
    expect((await app.get(DataSource).query('SELECT count(*) FROM auth_sessions'))[0].count).toBe('2');

    const patch = (username: string) =>
      fetch(`${base}/api/users/me`, {
        method: 'PATCH',
        headers: { cookie: session, 'content-type': 'application/json' },
        body: JSON.stringify({ username }),
      });
    expect(((await (await patch('  Tom la Kana  ')).json()) as { username: string }).username).toBe('Tom la Kana');
    expect((await patch('<script>')).status).toBe(400);

    // La suppression du compte efface aussi ses identités.
    expect((await fetch(`${base}/api/users/me`, { method: 'DELETE', headers: { cookie: session } })).status).toBe(204);
    const counts = await app.get(DataSource).query(
      'SELECT (SELECT count(*) FROM users) u, (SELECT count(*) FROM auth_identities) i, (SELECT count(*) FROM auth_sessions) s',
    );
    expect(counts[0]).toEqual({ u: '0', i: '0', s: '0' });
  });

  describe('Google, e-mail haché et liaison', () => {
    const db = () => app.get(DataSource);
    const sessionCookie = (res: Response) => getCookie(res, 'kd_session');

    /** Parcours complet de connexion (départ + retour) chez un fournisseur. */
    const signIn = async (provider: 'discord' | 'google', session?: string) => {
      const start = await fetch(`${base}/api/auth/${provider}`, { redirect: 'manual' });
      const state = new URL(start.headers.get('location') as string).searchParams.get('state');
      const res = await fetch(`${base}/api/auth/${provider}/callback?code=abc&state=${state}`, {
        redirect: 'manual',
        headers: { cookie: [getCookie(start, 'kd_oauth_state'), session].filter(Boolean).join('; ') },
      });
      return res;
    };
    const me = async (session: string) =>
      (await (await fetch(`${base}/api/users/me`, { headers: { cookie: session } })).json()) as {
        id: string;
        identities: Array<{ provider: string }>;
      };
    const hashes = async () =>
      (await db().query('SELECT provider, email_hash FROM auth_identities ORDER BY provider')) as Array<{
        provider: string;
        email_hash: string | null;
      }>;

    /** Lance une liaison depuis une session ; renvoie le cookie de state et le state. */
    const startLink = async (provider: 'discord' | 'google', session: string) => {
      const res = await fetch(`${base}/api/auth/${provider}/link`, { method: 'POST', headers: { cookie: session } });
      expect(res.status).toBe(201);
      const { url } = (await res.json()) as { url: string };
      return { url: new URL(url), cookie: getCookie(res, 'kd_oauth_state') as string };
    };
    const finishLink = (provider: 'discord' | 'google', link: { url: URL; cookie: string }, session: string) =>
      fetch(`${base}/api/auth/${provider}/callback?code=abc&state=${link.url.searchParams.get('state')}`, {
        redirect: 'manual',
        headers: { cookie: `${link.cookie}; ${session}` },
      });

    it('redirige vers Google avec select_account et les scopes openid profile email', async () => {
      const res = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
      const location = new URL(res.headers.get('location') as string);
      expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(location.searchParams.get('scope')).toBe('openid profile email');
      expect(location.searchParams.get('prompt')).toBe('select_account');
    });

    it('première connexion Google : compte créé, empreinte enregistrée (jamais l\'e-mail), avatar Google', async () => {
      const res = await signIn('google');
      expect(res.headers.get('location')).toBe(`${APP_URL}/`);
      const session = sessionCookie(res) as string;
      const user = await me(session);
      expect(user.identities).toEqual([expect.objectContaining({ provider: 'google' })]);
      const rows = await hashes();
      expect(rows[0].email_hash).toMatch(/^[0-9a-f]{64}$/);
      // L'e-mail n'est nulle part en base.
      const dump = JSON.stringify(await db().query('SELECT * FROM auth_identities'));
      expect(dump.toLowerCase()).not.toContain('thomas@example.com');
    });

    it("reconnexion : l'empreinte est recalculée (et passe à null si l'e-mail n'est plus vérifié)", async () => {
      await signIn('discord');
      const [{ email_hash: first }] = await hashes();
      expect(first).toMatch(/^[0-9a-f]{64}$/);

      discordUser = { ...discordUser, email: 'autre@example.com' };
      await signIn('discord');
      const [{ email_hash: second }] = await hashes();
      expect(second).toMatch(/^[0-9a-f]{64}$/);
      expect(second).not.toBe(first);

      discordUser = { ...discordUser, verified: false };
      await signIn('discord');
      expect((await hashes())[0].email_hash).toBeNull();
      expect((await db().query('SELECT count(*) FROM users'))[0].count).toBe('1');
    });

    it('e-mail non vérifié ou absent : aucune empreinte', async () => {
      discordUser = { ...discordUser, verified: false };
      await signIn('discord');
      googleUser = { sub: 'g-2', name: 'Sans mail' };
      await signIn('google');
      expect((await hashes()).map((r) => r.email_hash)).toEqual([null, null]);
    });

    it("bloque la création si l'e-mail vérifié correspond à un autre fournisseur (account_exists)", async () => {
      await signIn('discord');
      const res = await signIn('google');
      expect(res.headers.get('location')).toBe(`${APP_URL}/login?error=account_exists&provider=discord&from=google`);
      expect(sessionCookie(res)).toBeUndefined();
      expect((await db().query('SELECT count(*) FROM users'))[0].count).toBe('1');
      expect((await db().query('SELECT count(*) FROM auth_sessions'))[0].count).toBe('1'); // celle de Discord
      expect((await hashes()).map((r) => r.provider)).toEqual(['discord']);
    });

    it("ne bloque pas si l'autre e-mail n'est pas vérifié ou si les adresses diffèrent", async () => {
      await signIn('discord');
      googleUser = { ...googleUser, email: 't.homas@example.com' }; // les points ne sont pas normalisés
      const res = await signIn('google');
      expect(res.headers.get('location')).toBe(`${APP_URL}/`);
      expect((await db().query('SELECT count(*) FROM users'))[0].count).toBe('2');
    });

    it("l'avatar reste celui du premier fournisseur, même en se connectant par un fournisseur lié ensuite", async () => {
      const avatarOf = async (session: string) => ((await (await fetch(`${base}/api/users/me`, { headers: { cookie: session } })).json()) as { avatarUrl: string }).avatarUrl;
      const session = sessionCookie(await signIn('discord')) as string;
      const initial = await avatarOf(session);
      expect(initial).toContain('discordapp.com');
      await finishLink('google', await startLink('google', session), session);

      const viaGoogle = sessionCookie(await signIn('google')) as string;
      expect(await avatarOf(viaGoogle)).toBe(initial);

      // Le premier fournisseur, lui, continue de mettre l'avatar à jour.
      discordUser = { ...discordUser, avatar: 'abc123' };
      expect(await avatarOf(sessionCookie(await signIn('discord')) as string)).toContain('/avatars/123456789012345678/abc123');
    });

    it('lie Google à un compte connecté, sans rapprochement par e-mail, et met à jour l\'empreinte', async () => {
      const session = sessionCookie(await signIn('discord')) as string;
      googleUser = { ...googleUser, email: 'tout-autre@example.com' };
      const link = await startLink('google', session);
      expect(link.url.origin + link.url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(link.url.searchParams.get('scope')).toBe('openid profile email');

      const res = await finishLink('google', link, session);
      expect(res.headers.get('location')).toBe(`${APP_URL}/profile?linked=google`);
      expect(sessionCookie(res)).toBeUndefined(); // pas de nouvelle session
      const user = await me(session);
      expect(user.identities.map((i) => i.provider).sort()).toEqual(['discord', 'google']);
      expect((await hashes()).every((r) => /^[0-9a-f]{64}$/.test(r.email_hash ?? ''))).toBe(true);
    });

    it("refuse la liaison si l'identité appartient déjà à un autre compte", async () => {
      await signIn('google'); // compte A, avec Google
      discordUser = { ...discordUser, id: '999', email: 'b@example.com' };
      const sessionB = sessionCookie(await signIn('discord')) as string; // compte B
      const link = await startLink('google', sessionB);
      const res = await finishLink('google', link, sessionB);
      expect(res.headers.get('location')).toBe(`${APP_URL}/profile?link_error=conflict`);
      expect((await me(sessionB)).identities.map((i) => i.provider)).toEqual(['discord']);
      expect((await db().query('SELECT count(*) FROM auth_identities'))[0].count).toBe('2');
    });

    it('refuse la liaison si la session courante ne correspond pas au compte qui l\'a demandée', async () => {
      const sessionA = sessionCookie(await signIn('discord')) as string;
      const link = await startLink('google', sessionA);
      // Autre utilisateur connecté dans le navigateur au retour.
      googleUser = { sub: 'g-other', name: 'Autre', email: 'autre@example.com', email_verified: true };
      const sessionB = sessionCookie(await signIn('google')) as string;
      const res = await finishLink('google', link, sessionB);
      expect(res.headers.get('location')).toBe(`${APP_URL}/profile?link_error=session`);
      expect((await me(sessionB)).identities.map((i) => i.provider)).toEqual(['google']);
      // Sans session du tout.
      const noSession = await fetch(`${base}/api/auth/google/callback?code=abc&state=${link.url.searchParams.get('state')}`, {
        redirect: 'manual',
        headers: { cookie: link.cookie },
      });
      expect(noSession.headers.get('location')).toBe(`${APP_URL}/profile?link_error=session`);
    });

    it("exige une session pour démarrer une liaison, refuse un fournisseur inconnu, et un cookie de login ne sert pas de cookie de liaison", async () => {
      expect((await fetch(`${base}/api/auth/google/link`, { method: 'POST' })).status).toBe(401);
      const session = sessionCookie(await signIn('discord')) as string;
      expect((await fetch(`${base}/api/auth/facebook/link`, { method: 'POST', headers: { cookie: session } })).status).toBe(404);
      // Un state de Discord ne passe pas sur le callback de Google.
      const start = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
      const state = new URL(start.headers.get('location') as string).searchParams.get('state');
      const res = await fetch(`${base}/api/auth/google/callback?code=abc&state=${state}`, {
        redirect: 'manual',
        headers: { cookie: getCookie(start, 'kd_oauth_state') as string },
      });
      expect(res.headers.get('location')).toBe(`${APP_URL}/login?error=state`);
    });

    it('un jeton de session ne passe pas pour un cookie de state', async () => {
      const session = sessionCookie(await signIn('discord')) as string;
      const res = await fetch(`${base}/api/auth/discord/callback?code=abc&state=x`, {
        redirect: 'manual',
        headers: { cookie: session.replace('kd_session=', 'kd_oauth_state=') },
      });
      expect(res.headers.get('location')).toBe(`${APP_URL}/login?error=state`);
    });

    it('dissocie un fournisseur, mais jamais la dernière connexion', async () => {
      const session = sessionCookie(await signIn('discord')) as string;
      const del = (provider: string) =>
        fetch(`${base}/api/users/me/identities/${provider}`, { method: 'DELETE', headers: { cookie: session } });
      expect((await del('discord')).status).toBe(409); // seule identité
      expect((await del('google')).status).toBe(404); // pas liée
      expect((await del('facebook')).status).toBe(404);

      const link = await startLink('google', session);
      await finishLink('google', link, session);
      expect((await del('discord')).status).toBe(204);
      expect((await me(session)).identities.map((i) => i.provider)).toEqual(['google']);
      expect((await del('google')).status).toBe(409);
    });

    it("n'expose ni l'e-mail ni l'empreinte dans les réponses de l'API", async () => {
      const session = sessionCookie(await signIn('discord')) as string;
      await finishLink('google', await startLink('google', session), session);
      const [hash] = (await hashes()).map((r) => r.email_hash as string);
      const bodies = [
        await (await fetch(`${base}/api/users/me`, { headers: { cookie: session } })).text(),
        await (await fetch(`${base}/api/users/me/sessions`, { headers: { cookie: session } })).text(),
        await (await fetch(`${base}/api/leaderboard`, { headers: { cookie: session } })).text(),
      ];
      for (const body of bodies) {
        expect(body.toLowerCase()).not.toContain('example.com');
        expect(body).not.toContain(hash);
        expect(body).not.toMatch(/email/i);
      }
    });
  });
});
