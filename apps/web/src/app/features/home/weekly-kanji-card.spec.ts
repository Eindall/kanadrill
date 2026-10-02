import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { WeeklyKanjiDto } from '@kanadrill/shared';
import { CatalogService } from '../../core/catalog.service';
import { WeeklyKanjiCard } from './weekly-kanji-card';

const KANJI: WeeklyKanjiDto = {
  id: 'k1',
  character: '日',
  meanings: ['jour', 'soleil'],
  on: ['ニチ', 'ジツ'],
  kun: ['ひ'],
  jlpt: 'N5',
  inDictionary: false,
  weekStart: '2026-10-12',
  nextChange: '2026-10-19',
};

async function render(weekly: WeeklyKanjiDto | null | Error, add: () => Promise<number> = async () => 1) {
  const stub = {
    loadWeeklyKanji: () => (weekly instanceof Error ? Promise.reject(weekly) : Promise.resolve(weekly)),
    addToDictionary: vi.fn(add),
  };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: CatalogService, useValue: stub }] });
  const fixture = TestBed.createComponent(WeeklyKanjiCard);
  await fixture.whenStable();
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, root, stub, settle, button: () => root.querySelector('button') };
}

describe('WeeklyKanjiCard', () => {
  it('affiche le kanji, son sens, ses lectures, son niveau et un lien vers sa fiche', async () => {
    const { root } = await render(KANJI);
    expect(root.querySelector('h2')?.textContent).toContain('Kanji de la semaine');
    expect(root.textContent).toContain('日');
    expect(root.textContent).toContain('jour, soleil');
    expect(root.textContent).toContain('ニチ、ジツ、ひ');
    expect(root.textContent).toContain('JLPT N5');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/learn/k1');
    expect(root.textContent).toContain('Un nouveau kanji arrive lundi 19 octobre');
  });

  it('ajoute le kanji au dictionnaire et confirme', async () => {
    const { root, stub, button, settle } = await render(KANJI);
    button()!.click();
    await settle();
    expect(stub.addToDictionary).toHaveBeenCalledWith(['k1']);
    const confirmation = root.querySelector('[role=status]');
    expect(confirmation?.textContent).toContain('Ajouté à ton dictionnaire');
    expect(confirmation?.textContent).toContain('lundi 19 octobre');
    expect(button()).toBeNull(); // plus de bouton une fois ajouté
  });

  it('montre « dans ton dictionnaire », sans bouton, quand il y est déjà', async () => {
    const { root, button } = await render({ ...KANJI, inDictionary: true });
    expect(root.querySelector('[role=status]')?.textContent).toContain('Dans ton dictionnaire');
    expect(root.querySelector('[role=status]')?.textContent).not.toContain('Ajouté');
    expect(button()).toBeNull();
  });

  it('signale l\'échec de l\'ajout et laisse réessayer', async () => {
    const { root, button, settle } = await render(KANJI, () => Promise.reject(new Error('réseau')));
    button()!.click();
    await settle();
    expect(root.querySelector('[role=alert]')?.textContent).toContain("L'ajout a échoué");
    expect(button()).not.toBeNull();
    expect(button()!.disabled).toBe(false);
  });

  it('n\'affiche rien quand il ne reste aucun kanji à suggérer (tout est ajouté)', async () => {
    expect((await render(null)).root.querySelector('section')).toBeNull();
  });

  it('n\'affiche rien en cas d\'erreur de chargement', async () => {
    expect((await render(new Error('hors ligne'))).root.querySelector('section')).toBeNull();
  });
});
