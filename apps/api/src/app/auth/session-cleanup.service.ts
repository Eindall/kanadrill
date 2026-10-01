import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CLEANUP_INTERVAL_MS } from './session';
import { SessionService } from './session.service';

/** Supprime régulièrement les sessions périmées (au démarrage, puis toutes les 6 h). Simple minuteur : pas de dépendance. */
@Injectable()
export class SessionCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly sessions: SessionService) {}

  onApplicationBootstrap(): void {
    void this.run();
    this.timer = setInterval(() => void this.run(), CLEANUP_INTERVAL_MS);
    this.timer.unref(); // ne retient pas le processus à l'arrêt
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(): Promise<number> {
    try {
      const deleted = await this.sessions.deleteStale();
      if (deleted > 0) this.logger.log(`${deleted} session(s) périmée(s) supprimée(s)`);
      return deleted;
    } catch (error) {
      this.logger.error(`Nettoyage des sessions impossible : ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
