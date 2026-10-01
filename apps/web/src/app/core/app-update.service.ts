import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/**
 * Mises à jour de l'application (service worker). Sans cela, un utilisateur resterait sur l'ancienne version
 * jusqu'à sa prochaine ouverture : gênant dès qu'une nouvelle version change l'API.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);

  /** Une nouvelle version est téléchargée et prête à être activée. */
  readonly updateReady = signal(false);

  constructor() {
    if (!this.sw.isEnabled) return; // développement, navigateur sans service worker…

    this.sw.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));

    // Cache corrompu ou version introuvable : on repart d'un chargement propre.
    this.sw.unrecoverable.subscribe(() => this.reload());

    // Une appli installée reste souvent ouverte en arrière-plan : on vérifie quand on y revient.
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') void this.sw.checkForUpdate().catch(() => undefined);
    });
  }

  /** Active la nouvelle version puis recharge la page. */
  async apply(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      this.reload();
    }
  }

  private reload(): void {
    this.document.location.reload();
  }
}
