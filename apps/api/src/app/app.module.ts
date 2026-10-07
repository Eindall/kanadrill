// TypeORM charge le driver PostgreSQL dynamiquement : sans cet import, Nx ne le voit pas et l'omet du
// package.json de production (le conteneur planterait au démarrage avec « Postgres package has not been found »).
import 'pg';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { ENTITIES } from './database/entities';
import { MIGRATIONS } from './database/migrations';
import { HealthController } from './health.controller';
import { LearningModule } from './learning/learning.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Limite globale : 100 requêtes/minute/IP (AuthController applique une limite plus stricte).
    // Désactivée sous Jest (NODE_ENV=test) : les suites d'intégration enchaînent bien plus de connexions que 20/min.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }], skipIf: () => process.env['NODE_ENV'] === 'test' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        uuidExtension: 'pgcrypto' as const,
        entities: ENTITIES,
        migrations: MIGRATIONS,
        // Les migrations sont appliquées au démarrage ; `synchronize` reste désactivé (jamais en prod).
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    AuthModule,
    UsersModule,
    LearningModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
