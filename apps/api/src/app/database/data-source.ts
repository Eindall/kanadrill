import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

/**
 * DataSource utilisée par la CLI TypeORM (migration:generate / run / revert).
 * L'application NestJS construit la sienne dans AppModule, avec les mêmes entités et migrations.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env['DATABASE_URL'],
  // gen_random_uuid() est natif depuis Postgres 13 : pas d'extension à installer.
  uuidExtension: 'pgcrypto',
  entities: ENTITIES,
  migrations: MIGRATIONS,
});
