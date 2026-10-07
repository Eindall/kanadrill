import { hashEmail } from './email-hash';

const KEY = 'k'.repeat(32);

describe('hashEmail', () => {
  it('produit un HMAC-SHA256 hexadécimal de 64 caractères', () => {
    expect(hashEmail('a@b.fr', true, KEY)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignore la casse et les espaces autour', () => {
    expect(hashEmail('  Thomas@Example.COM ', true, KEY)).toBe(hashEmail('thomas@example.com', true, KEY));
  });

  it('ne retire ni les points ni les +alias', () => {
    const base = hashEmail('ab@example.com', true, KEY);
    expect(hashEmail('a.b@example.com', true, KEY)).not.toBe(base);
    expect(hashEmail('ab+kana@example.com', true, KEY)).not.toBe(base);
  });

  it('dépend de la clé', () => {
    expect(hashEmail('a@b.fr', true, KEY)).not.toBe(hashEmail('a@b.fr', true, 'z'.repeat(32)));
  });

  it("renvoie null si l'e-mail est absent, vide ou non vérifié", () => {
    expect(hashEmail(undefined, true, KEY)).toBeNull();
    expect(hashEmail(null, true, KEY)).toBeNull();
    expect(hashEmail('   ', true, KEY)).toBeNull();
    expect(hashEmail('a@b.fr', false, KEY)).toBeNull();
    expect(hashEmail('a@b.fr', undefined, KEY)).toBeNull();
    expect(hashEmail('a@b.fr', 'true', KEY)).toBeNull();
  });
});
