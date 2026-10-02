import { adaptToDevice, availableModes, configFromParams, configToParams, DEFAULT_CONFIG, loadSavedConfig, saveConfig, validateConfig } from './session-config';

const params = (query: string) => new URLSearchParams(query);

describe('configFromParams', () => {
  it('lit un réglage valide', () => {
    expect(configFromParams(params('count=50&types=hiragana,katakana&modes=choice,typing'))).toEqual({
      count: 50,
      types: ['hiragana', 'katakana'],
      modes: ['choice', 'typing'],
    });
  });
  it.each([
    '',
    'count=20&types=hiragana&modes=choice',
    'count=15&types=&modes=choice',
    'count=15&types=hiragana&modes=',
    'count=15&types=kanji&modes=choice',
    'count=15&types=hiragana,emoji&modes=choice',
    'count=15&types=hiragana&modes=dessin',
  ])('refuse « %s »', (query) => {
    expect(configFromParams(params(query))).toBeNull();
  });
  it('accepte le tracé', () => {
    expect(configFromParams(params('count=15&types=hiragana&modes=choice,drawing'))?.modes).toEqual(['choice', 'drawing']);
  });
  it('retire les doublons', () => {
    expect(configFromParams(params('count=15&types=hiragana,hiragana&modes=choice'))?.types).toEqual(['hiragana']);
  });
});

describe('configToParams', () => {
  it('fait l\'aller-retour avec configFromParams', () => {
    const config = { count: 15 as const, types: ['katakana' as const], modes: ['typing' as const] };
    expect(configFromParams(new URLSearchParams(configToParams(config)))).toEqual(config);
  });
});

describe('validateConfig', () => {
  it('refuse une liste vide', () => {
    expect(validateConfig({ count: 30, types: [], modes: ['choice'] })).toBeNull();
  });
});

describe('réglage mémorisé', () => {
  beforeEach(() => localStorage.clear());

  it('renvoie le réglage par défaut quand rien n\'est mémorisé', () => {
    expect(loadSavedConfig()).toEqual(DEFAULT_CONFIG);
  });
  it('restitue le dernier réglage', () => {
    const config = { count: 50 as const, types: ['katakana' as const], modes: ['choice' as const, 'typing' as const] };
    saveConfig(config);
    expect(loadSavedConfig()).toEqual(config);
  });
  it('ignore un contenu corrompu ou invalide', () => {
    localStorage.setItem('kanadrill.sessionConfig', '{pas du json');
    expect(loadSavedConfig()).toEqual(DEFAULT_CONFIG);
    localStorage.setItem('kanadrill.sessionConfig', JSON.stringify({ count: 7, types: ['x'], modes: [] }));
    expect(loadSavedConfig()).toEqual(DEFAULT_CONFIG);
  });
});

describe('exercices selon l\'appareil', () => {
  const config = { count: 30, types: ['hiragana'], modes: ['typing', 'drawing'] } as const;

  it('propose le tracé seulement sur écran tactile', () => {
    expect(availableModes(true)).toEqual(['choice', 'typing', 'drawing']);
    expect(availableModes(false)).toEqual(['choice', 'typing']);
  });
  it('retire le tracé d\'un réglage mémorisé quand l\'appareil n\'est pas tactile', () => {
    expect(adaptToDevice({ ...config, types: [...config.types], modes: [...config.modes] }, false).modes).toEqual(['typing']);
    expect(adaptToDevice({ ...config, types: [...config.types], modes: [...config.modes] }, true).modes).toEqual(['typing', 'drawing']);
  });
  it('retombe sur le QCM si le tracé était le seul exercice', () => {
    expect(adaptToDevice({ count: 15, types: ['hiragana'], modes: ['drawing'] }, false).modes).toEqual(['choice']);
  });
});
