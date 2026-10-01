/**
 * Garde-fous de la configuration PWA : manifest installable, service worker qui ne touche pas à l'API,
 * nginx qui ne met pas en cache le service worker. Un oubli ici ne se voit qu'une fois déployé.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)));
const readText = (path: string) => read(path).toString('utf8');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
const manifest = JSON.parse(readText('../public/manifest.webmanifest')) as Record<string, unknown> & { icons: ManifestIcon[] };

/** Dimensions d'un PNG, lues dans son en-tête IHDR (pas de dépendance d'image). */
function pngSize(file: Buffer): string {
  expect(file.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`;
}

describe('manifest', () => {
  it('a les champs requis pour être installable', () => {
    expect(manifest).toMatchObject({ name: 'KanaDrill', lang: 'fr', display: 'standalone', start_url: '/', scope: '/' });
    expect(manifest['short_name']).toBeTruthy();
    expect(manifest['theme_color']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest['background_color']).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('référence des icônes qui existent, aux dimensions annoncées, dont une « maskable »', () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(pngSize(read(`../public/${icon.src}`))).toBe(icon.sizes);
    }
    const sizesFor = (purpose: string) => manifest.icons.filter((i) => i.purpose === purpose).map((i) => i.sizes);
    expect(sizesFor('any')).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(sizesFor('maskable')).toContain('512x512');
  });

  it('a la même couleur que la balise theme-color de index.html', () => {
    const html = readText('./index.html');
    expect(html).toContain(`<meta name="theme-color" content="${manifest['theme_color']}"`);
  });
});

describe('index.html', () => {
  const html = readText('./index.html');

  it('déclare le manifest et l\'icône iOS (qui existent)', () => {
    expect(html).toContain('<link rel="manifest" href="manifest.webmanifest"');
    expect(html).toContain('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png"');
    expect(pngSize(read('../public/icons/apple-touch-icon.png'))).toBe('180x180');
  });
});

describe('ngsw-config.json', () => {
  const config = JSON.parse(readText('../ngsw-config.json')) as {
    navigationUrls: string[];
    dataGroups?: unknown[];
    assetGroups: unknown[];
  };

  it('ne met jamais l\'API en cache (pas de dataGroups)', () => {
    expect(config.dataGroups ?? []).toEqual([]);
  });

  it('exclut /api des navigations : la connexion Discord est une navigation vers /api/auth/discord', () => {
    expect(config.navigationUrls).toContain('!/api/**');
    // L'exclusion ne sert à rien si une règle positive ne couvre pas le reste des pages.
    expect(config.navigationUrls).toContain('/**');
  });

  it('ne met en cache que la coque de l\'application', () => {
    expect(config.assetGroups).toHaveLength(2);
  });
});

describe('nginx.conf', () => {
  const conf = readText('../nginx.conf');
  const swRule = /location ~ \^\/\(\?:([^)]*)\)\$ \{([^}]*)\}/.exec(conf);

  it('ne met pas en cache le service worker, sa liste de fichiers et le manifest', () => {
    expect(swRule).not.toBeNull();
    const [, files, body] = swRule!;
    for (const file of ['ngsw-worker\\.js', 'ngsw\\.json', 'safety-worker\\.js']) {
      expect(files).toContain(file);
    }
    expect(body).toContain('expires -1;');
  });

  it('sert le manifest en application/manifest+json, sans cache, sans écraser la table des types MIME', () => {
    const rule = /location = \/manifest\.webmanifest \{([^}]*)\}/.exec(conf);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('default_type application/manifest+json;');
    expect(rule![1]).toContain('expires -1;');
    expect(conf).not.toMatch(/^\s*types\s*\{/m);
  });

  it('n\'utilise pas add_header dans cette règle (il ferait perdre les en-têtes de sécurité du bloc server)', () => {
    expect(swRule![2]).not.toContain('add_header');
  });

  it('place cette règle avant la règle de cache d\'un an, sinon ngsw-worker.js serait mis en cache un an', () => {
    expect(conf.indexOf(swRule![0])).toBeLessThan(conf.indexOf('expires 1y;'));
  });

  it('sert le manifest compressé', () => {
    expect(conf).toContain('application/manifest+json');
  });
});
