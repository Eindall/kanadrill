import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSession } from './auth-session.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_ABSOLUTE_MAX_MS } from './session';
import { SessionCleanupService } from './session-cleanup.service';
import { SessionService } from './session.service';

/** Brique de base partagée : sessions (JWT + table), nettoyage et guard. Sans dépendance vers les users. */
@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSession]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: SESSION_ABSOLUTE_MAX_MS / 1000 },
      }),
    }),
  ],
  providers: [SessionService, SessionCleanupService, JwtAuthGuard],
  exports: [SessionService, JwtAuthGuard],
})
export class SessionModule {}
