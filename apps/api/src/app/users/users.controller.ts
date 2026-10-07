import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { isAuthProvider, type UserDto } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionService } from '../auth/session.service';
import { UpdateProfileDto } from './update-profile.dto';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async me(@CurrentUserId() userId: string): Promise<UserDto> {
    return this.users.toDto(await this.users.findOneOrFail(userId));
  }

  @Patch()
  async update(@CurrentUserId() userId: string, @Body() body: UpdateProfileDto): Promise<UserDto> {
    return this.users.toDto(await this.users.updateProfile(userId, body));
  }

  /** Dissocie un fournisseur du compte (409 pour la dernière connexion). */
  @Delete('identities/:provider')
  @HttpCode(204)
  async unlink(@CurrentUserId() userId: string, @Param('provider') provider: string): Promise<void> {
    if (!isAuthProvider(provider)) throw new NotFoundException('Connexion introuvable');
    await this.users.unlinkIdentity(userId, provider);
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUserId() userId: string, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.users.remove(userId);
    this.sessions.clearCookie(res);
  }
}
