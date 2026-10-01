import { Body, Controller, Delete, Get, HttpCode, Patch, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { UserDto } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SESSION_COOKIE } from '../auth/session';
import { UpdateProfileDto } from './update-profile.dto';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUserId() userId: string): Promise<UserDto> {
    return this.users.toDto(await this.users.findOneOrFail(userId));
  }

  @Patch()
  async update(@CurrentUserId() userId: string, @Body() body: UpdateProfileDto): Promise<UserDto> {
    return this.users.toDto(await this.users.updateProfile(userId, body));
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUserId() userId: string, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.users.remove(userId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
