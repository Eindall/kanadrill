import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY } from './theme';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let systemDark: boolean;
  let onChange: ((event: { matches: boolean }) => void) | undefined;

  function create(): ThemeService {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: systemDark,
      media: query,
      addEventListener: (_: string, cb: (event: { matches: boolean }) => void) => (onChange = cb),
    }));
    TestBed.resetTestingModule();
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }
  const isDark = () => document.documentElement.classList.contains('dark');

  beforeEach(() => {
    systemDark = false;
    onChange = undefined;
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#eef1f5">');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it('suit le système par défaut', () => {
    systemDark = true;
    const service = create();
    expect(service.preference()).toBe('system');
    expect(service.resolved()).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('suit un changement du système tant que la préférence est « system »', () => {
    const service = create();
    expect(isDark()).toBe(false);
    onChange!({ matches: true });
    TestBed.tick();
    expect(service.resolved()).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('ignore le système quand le choix est explicite, le mémorise et met à jour theme-color', () => {
    systemDark = true;
    const service = create();
    service.set('light');
    TestBed.tick();
    expect(isDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#eef1f5');
    onChange!({ matches: false });
    onChange!({ matches: true });
    TestBed.tick();
    expect(isDark()).toBe(false);
  });

  it('relit la préférence mémorisée, et ignore une valeur corrompue', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(create().preference()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'violet');
    expect(create().preference()).toBe('system');
  });

  it('bascule vers l\'inverse du thème affiché', () => {
    systemDark = true;
    const service = create();
    service.toggle();
    expect(service.preference()).toBe('light');
    service.toggle();
    expect(service.preference()).toBe('dark');
  });

  it('fonctionne quand localStorage lève une exception', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    const service = create();
    expect(service.preference()).toBe('system');
    expect(() => service.set('dark')).not.toThrow();
    expect(service.preference()).toBe('dark');
  });
});
