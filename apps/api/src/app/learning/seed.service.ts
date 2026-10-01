import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedItems } from './seed/seed-items';

/** Charge les données de base après les migrations (qui s'exécutent à l'initialisation de TypeORM). */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const count = await seedItems(this.dataSource);
    this.logger.log(`${count} kana synchronisés`);
  }
}
