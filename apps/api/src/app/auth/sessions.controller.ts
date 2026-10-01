import { Controller, Delete, Get, HttpCode, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { SessionInfoDto } from '@kanadrill/shared';
import { CurrentSessionId, CurrentUserId } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionService } from './session.service';

/** Appareils connectés de l'utilisateur : les voir et les déconnecter. */
@Controller('users/me/sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  list(@CurrentUserId() userId: string, @CurrentSessionId() currentId: string): Promise<SessionInfoDto[]> {
    return this.sessions.list(userId, currentId);
  }

  /** Déconnecte tous les autres appareils (la session courante reste ouverte). */
  @Delete()
  @HttpCode(204)
  async revokeOthers(@CurrentUserId() userId: string, @CurrentSessionId() currentId: string): Promise<void> {
    await this.sessions.revokeOthers(userId, currentId);
  }

  /** Déconnecte un appareil. S'il s'agit de l'appareil courant, le cookie est aussi effacé. */
  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @CurrentUserId() userId: string,
    @CurrentSessionId() currentId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revoke(userId, id);
    if (id === currentId) this.sessions.clearCookie(res);
  }
}
