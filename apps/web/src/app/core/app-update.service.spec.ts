import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  const versionUpdates = new Subject<{ type: string }>();
  const unrecoverable = new Subject<unknown>();
  let sw: { isEnabled: boolean; versionUpdates: Subject<{ type: string }>; unrecoverable: Subject<unknown>; activateUpdate: ReturnType<typeof vi.fn>; checkForUpdate: ReturnType<typeof vi.fn> };
  let reload: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;
  let listeners: Array<() => void>;

  function create(isEnabled = true): AppUpdateService {
    reload = vi.fn();
    listeners = [];
    visibility = 'hidden';
    sw = {
      isEnabled,
      versionUpdates,
      unrecoverable,
      activateUpdate: vi.fn().mockResolvedValue(true),
      checkForUpdate: vi.fn().mockResolvedValue(true),
    };
    const fakeDocument = {
      location: { reload },
      get visibilityState() {
        return visibility;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: sw },
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    return TestBed.inject(AppUpdateService);
  }

  it('signale une nouvelle version prête, et ignore les autres événements', () => {
    const service = create();
    versionUpdates.next({ type: 'VERSION_DETECTED' });
    expect(service.updateReady()).toBe(false);
    versionUpdates.next({ type: 'VERSION_READY' });
    expect(service.updateReady()).toBe(true);
  });

  it('active la nouvelle version puis recharge', async () => {
    const service = create();
    await service.apply();
    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('recharge quand même si l\'activation échoue', async () => {
    const service = create();
    sw.activateUpdate.mockRejectedValue(new Error('boom'));
    await expect(service.apply()).rejects.toThrow('boom');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('recharge si le service worker est dans un état irrécupérable', () => {
    create();
    unrecoverable.next({ reason: 'cache corrompu' });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('cherche une mise à jour au retour sur l\'appli, pas quand elle passe en arrière-plan', () => {
    create();
    visibility = 'hidden';
    listeners.forEach((listener) => listener());
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    visibility = 'visible';
    listeners.forEach((listener) => listener());
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien quand le service worker est désactivé (développement)', () => {
    const service = create(false);
    versionUpdates.next({ type: 'VERSION_READY' });
    expect(service.updateReady()).toBe(false);
    expect(listeners).toHaveLength(0);
  });
});
