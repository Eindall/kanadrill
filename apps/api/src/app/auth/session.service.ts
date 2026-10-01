import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { CookieOptions, Response } from 'express';
import { DataSource, IsNull, MoreThan, Not, Repository } from 'typeorm';
import type { SessionInfoDto } from '@kanadrill/shared';
import { AuthSession } from './auth-session.entity';
import {
  MAX_ACTIVE_SESSIONS,
  REVOKED_RETENTION_MS,
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_COOKIE,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './session';
import { parseUserAgent } from './user-agent';

interface JwtPayload {
  sub?: string;
  jti?: string;
}

/** Résultat d'une authentification réussie. `renewedUntil` : la session vient d'être prolongée (cookie à réémettre). */
export interface Authenticated {
  userId: string;
  sessionId: string;
  renewedUntil: Date | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sessions : un JWT signé dans un cookie httpOnly, dont le `jti` désigne une ligne de `auth_sessions`.
 * Cette ligne fait foi : elle peut être révoquée (déconnexion réelle, liste des appareils) et expire de façon
 * glissante (`SESSION_IDLE_TTL_MS` sans usage), dans la limite de `SESSION_ABSOLUTE_MAX_MS`.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
  ) {}

  /** Ouvre une session : crée la ligne, signe le jeton, pose le cookie. */
  async start(res: Response, userId: string, userAgent?: string): Promise<AuthSession> {
    const { token, session } = await this.issue(userId, userAgent);
    this.setCookie(res, token, session.expiresAt);
    return session;
  }

  /** Crée une session et son jeton, sans toucher à la réponse HTTP (utile aussi aux tests). */
  async issue(userId: string, userAgent?: string, now = new Date()): Promise<{ token: string; session: AuthSession }> {
    const session = await this.sessions.save(
      this.sessions.create({
        userId,
        userAgent: userAgent ? userAgent.slice(0, 256) : null,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + SESSION_IDLE_TTL_MS),
      }),
    );
    await this.revokeBeyondLimit(userId, now);
    // Le JWT expire au plafond absolu ; l'expiration glissante, plus courte, est dans la ligne.
    const token = await this.jwt.signAsync({ sub: userId }, { jwtid: session.id, expiresIn: SESSION_ABSOLUTE_MAX_MS / 1000 });
    return { token, session };
  }

  /**
   * Valide un jeton : signature, puis session active en base (non révoquée, non expirée, bien celle de `sub`).
   * Prolonge la session au plus toutes les `SESSION_TOUCH_INTERVAL_MS`. `null` si le jeton n'est pas valable.
   */
  async authenticate(token: string, now = new Date()): Promise<Authenticated | null> {
    const payload = await this.verify(token);
    if (!payload?.sub || !payload.jti || !UUID.test(payload.jti)) return null;

    const session = await this.sessions.findOneBy({ id: payload.jti });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= now) return null;

    return { userId: session.userId, sessionId: session.id, renewedUntil: await this.touch(session, now) };
  }

  /** Déconnexion : révoque la session du cookie (même expirée côté JWT) et efface le cookie. Sans erreur si invalide. */
  async logout(token: string | undefined, res: Response): Promise<void> {
    const payload = token ? await this.verify(token, true) : null;
    if (payload?.jti && payload.sub && UUID.test(payload.jti)) {
      await this.sessions.update({ id: payload.jti, userId: payload.sub, revokedAt: IsNull() }, { revokedAt: new Date() });
    }
    this.clearCookie(res);
  }

  /** Sessions actives d'un utilisateur, la plus récemment utilisée d'abord. */
  async list(userId: string, currentSessionId: string, now = new Date()): Promise<SessionInfoDto[]> {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(now) },
      order: { lastUsedAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      device: parseUserAgent(row.userAgent),
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
      current: row.id === currentSessionId,
    }));
  }

  /** Révoque une session de cet utilisateur ; 404 si elle n'existe pas, est déjà révoquée ou appartient à un autre. */
  async revoke(userId: string, sessionId: string): Promise<void> {
    if (!UUID.test(sessionId)) throw new NotFoundException('Session introuvable');
    const result = await this.sessions.update({ id: sessionId, userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    if (!result.affected) throw new NotFoundException('Session introuvable');
  }

  /** Révoque toutes les sessions de l'utilisateur sauf la courante. Renvoie le nombre de sessions révoquées. */
  async revokeOthers(userId: string, currentSessionId: string): Promise<number> {
    const result = await this.sessions.update(
      { userId, revokedAt: IsNull(), id: Not(currentSessionId) },
      { revokedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Supprime les sessions expirées, et les révoquées depuis plus de `REVOKED_RETENTION_MS`. */
  async deleteStale(now = new Date()): Promise<number> {
    const result = await this.sessions
      .createQueryBuilder()
      .delete()
      .where('expires_at <= :now OR revoked_at <= :limit', { now, limit: new Date(now.getTime() - REVOKED_RETENTION_MS) })
      .execute();
    return result.affected ?? 0;
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(Math.max(0, expiresAt.getTime() - Date.now())));
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge,
    };
  }

  private async verify(token: string, ignoreExpiration = false): Promise<JwtPayload | null> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, { ignoreExpiration });
    } catch {
      return null;
    }
  }

  /**
   * Marque la session comme utilisée et repousse son expiration, au plus toutes les `SESSION_TOUCH_INTERVAL_MS`
   * (un seul UPDATE conditionnel : pas de lecture-écriture, pas de course entre requêtes concurrentes).
   * Renvoie la nouvelle échéance si elle a été mise à jour, sinon `null`.
   */
  private async touch(session: AuthSession, now: Date): Promise<Date | null> {
    if (now.getTime() - session.lastUsedAt.getTime() < SESSION_TOUCH_INTERVAL_MS) return null;
    const [rows] = (await this.dataSource.query(
      `UPDATE auth_sessions
       SET last_used_at = $2,
           expires_at = LEAST($2::timestamptz + $3::double precision * interval '1 millisecond',
                              created_at + $4::double precision * interval '1 millisecond')
       WHERE id = $1 AND revoked_at IS NULL AND last_used_at <= $2::timestamptz - $5::double precision * interval '1 millisecond'
       RETURNING expires_at`,
      [session.id, now, SESSION_IDLE_TTL_MS, SESSION_ABSOLUTE_MAX_MS, SESSION_TOUCH_INTERVAL_MS],
    )) as [Array<{ expires_at: Date }>, number];
    return rows[0]?.expires_at ?? null;
  }

  /** Au-delà de `MAX_ACTIVE_SESSIONS` sessions actives, révoque les plus anciennes. */
  private async revokeBeyondLimit(userId: string, now: Date): Promise<void> {
    await this.dataSource.query(
      `UPDATE auth_sessions SET revoked_at = $2
       WHERE id IN (
         SELECT id FROM auth_sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2
         ORDER BY created_at DESC, id OFFSET $3
       )`,
      [userId, now, MAX_ACTIVE_SESSIONS],
    );
  }
}
