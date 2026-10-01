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
import { DiscordStrategy } from './discord.strategy';

const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
const APP_URL = 'http://localhost:4200';

(TEST_DATABASE_URL ? describe : describe.skip)('Authentification Discord', () => {
  let app: NestExpressApplication;
  let base: string;
  let failExchange = false;

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-test-secret-test-secret-test',
      APP_URL,
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_REDIRECT_URI: `${APP_URL}/api/auth/discord/callback`,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oauth2.get = (_url: string, _token: string, cb: any) =>
      cb(null, JSON.stringify({ id: '123456789012345678', username: 'thomas', global_name: 'Thomas', avatar: null }));

    await app.get(DataSource).query('TRUNCATE users CASCADE');
  }, 60_000);

  afterAll(async () => app?.close());

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
    expect(location.searchParams.get('scope')).toBe('identify');
    expect(getCookie(res, 'kd_oauth_state')).toBe(`kd_oauth_state=${location.searchParams.get('state')}`);
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
      expect(res.headers.getSetCookie().find((c) => c.startsWith('kd_session='))).toContain('HttpOnly');
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
    const counts = await app.get(DataSource).query('SELECT (SELECT count(*) FROM users) u, (SELECT count(*) FROM auth_identities) i');
    expect(counts[0]).toEqual({ u: '0', i: '0' });
  });
});
