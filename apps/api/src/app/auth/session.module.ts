import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionService } from './session.service';

/** Brique de base partagée : signature/lecture de la session et guard. Sans dépendance vers les users. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  providers: [SessionService, JwtAuthGuard],
  exports: [SessionService, JwtAuthGuard],
})
export class SessionModule {}
