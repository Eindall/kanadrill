import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { DiscordAuthGuard } from './discord-auth.guard';
import { DiscordStrategy } from './discord.strategy';
import { SessionModule } from './session.module';

@Module({
  imports: [PassportModule, SessionModule, UsersModule],
  controllers: [AuthController],
  providers: [DiscordStrategy, DiscordAuthGuard],
})
export class AuthModule {}
