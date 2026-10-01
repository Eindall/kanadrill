import { parseUserAgent } from './user-agent';

describe('parseUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 'Chrome sur Linux'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', 'Edge sur Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0', 'Opera sur Windows'],
    ['Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox sur Linux'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15', 'Safari sur macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', 'Safari sur iOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1', 'Chrome sur iOS'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', 'Chrome sur Android'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 'Firefox sur Android'],
  ])('%s', (ua, expected) => {
    expect(parseUserAgent(ua)).toBe(expected);
  });

  it('se rabat sur ce qui est connu, puis sur « Appareil inconnu »', () => {
    expect(parseUserAgent('curl/8.5.0')).toBe('Appareil inconnu');
    expect(parseUserAgent('')).toBe('Appareil inconnu');
    expect(parseUserAgent(undefined)).toBe('Appareil inconnu');
    expect(parseUserAgent(null)).toBe('Appareil inconnu');
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows');
    expect(parseUserAgent('Firefox/131.0')).toBe('Firefox');
  });
});
