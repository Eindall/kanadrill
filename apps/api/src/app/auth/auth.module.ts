import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { DiscordStrategy } from './discord.strategy';
import { GoogleStrategy } from './google.strategy';
import { OAuthStateService } from './oauth-state.service';
import { SessionModule } from './session.module';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [PassportModule, SessionModule, UsersModule],
  controllers: [AuthController, SessionsController],
  providers: [DiscordStrategy, GoogleStrategy, OAuthStateService],
})
export class AuthModule {}
