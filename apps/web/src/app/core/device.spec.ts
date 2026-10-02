import { isTouchDevice } from './device';

describe('isTouchDevice', () => {
  const original = window.matchMedia;
  afterEach(() => (window.matchMedia = original));

  const mockMatchMedia = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({ matches: matches && query === '(pointer: coarse)' })) as typeof window.matchMedia;
  };

  it('est vrai quand le pointeur principal est tactile', () => {
    mockMatchMedia(true);
    expect(isTouchDevice()).toBe(true);
  });
  it('est faux avec une souris', () => {
    mockMatchMedia(false);
    expect(isTouchDevice()).toBe(false);
  });
  it('est faux si matchMedia n\'existe pas ou échoue', () => {
    window.matchMedia = (() => {
      throw new Error('indisponible');
    }) as typeof window.matchMedia;
    expect(isTouchDevice()).toBe(false);
  });
});
