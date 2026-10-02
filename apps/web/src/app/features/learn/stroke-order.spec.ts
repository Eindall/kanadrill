import { TestBed } from '@angular/core/testing';
import { StrokeOrder } from './stroke-order';

const STROKES = [
  { d: 'M10,10c5,5,10,10,20,20', n: [8, 9] as [number, number] },
  { d: 'M50,10c0,20,0,40,0,60', n: [48, 9] as [number, number] },
];

function render() {
  const fixture = TestBed.createComponent(StrokeOrder);
  fixture.componentRef.setInput('strokes', STROKES);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  return { fixture, root, inkPaths: () => root.querySelectorAll('.ink path') };
}

describe('StrokeOrder', () => {
  it('dessine un fantôme et un trait animé par trait, dans l\'ordre, avec leurs numéros', () => {
    const { root, inkPaths } = render();
    expect(root.querySelectorAll('.ghost path')).toHaveLength(2);
    expect(inkPaths()).toHaveLength(2);
    expect(inkPaths()[1].getAttribute('d')).toBe(STROKES[1].d);
    expect(inkPaths()[0].getAttribute('pathLength')).toBe('1');
    expect([...root.querySelectorAll('.numbers text')].map((t) => t.textContent)).toEqual(['1', '2']);
    // Chaque trait démarre après le précédent.
    expect((inkPaths()[0] as SVGElement).style.getPropertyValue('--delay')).toBe('0s');
    expect(parseFloat((inkPaths()[1] as SVGElement).style.getPropertyValue('--delay'))).toBeGreaterThan(0);
  });

  it('recrée les traits animés au clic sur « Rejouer » (l\'animation repart)', () => {
    const { fixture, root, inkPaths } = render();
    const before = inkPaths()[0];
    root.querySelector('button')!.click();
    fixture.detectChanges();
    expect(inkPaths()[0]).not.toBe(before);
    expect(inkPaths()).toHaveLength(2);
  });

  it('masque les numéros quand on décoche la case', () => {
    const { fixture, root } = render();
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.numbers text')).toHaveLength(0);
  });
});
