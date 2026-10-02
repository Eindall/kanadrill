import { TestBed } from '@angular/core/testing';
import { DrawingPad } from './drawing-pad';

/** jsdom n'a pas PointerEvent : un MouseEvent du bon nom porte les mêmes coordonnées. */
function pointer(type: string, x: number, y: number, extra: Record<string, unknown> = {}): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.assign(event, { isPrimary: true, pointerId: 1, pointerType: 'touch', ...extra });
  return event;
}

function render(locked = false) {
  const fixture = TestBed.createComponent(DrawingPad);
  fixture.componentRef.setInput('locked', locked);
  fixture.detectChanges();
  const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
  // Zone de 109 × 109 px à l'origine : un pixel = une unité du repère.
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 109, height: 109, right: 109, bottom: 109, x: 0, y: 0 }) as DOMRect;
  const drawn = () => fixture.componentInstance.strokes();
  const flush = () => fixture.detectChanges();
  const stroke = (points: Array<[number, number]>) => {
    svg.dispatchEvent(pointer('pointerdown', ...points[0]));
    for (const p of points.slice(1)) svg.dispatchEvent(pointer('pointermove', ...p));
    svg.dispatchEvent(pointer('pointerup', ...points[points.length - 1]));
    flush();
  };
  return { fixture, svg, drawn, flush, stroke, root: fixture.nativeElement as HTMLElement };
}

describe('DrawingPad', () => {
  it('enregistre un trait par geste, dans le repère 109 × 109', () => {
    const { drawn, stroke, root } = render();
    stroke([[10, 10], [20, 20], [30, 40]]);
    stroke([[50, 5], [50, 90]]);
    expect(drawn()).toHaveLength(2);
    expect(drawn()[0]).toEqual([[10, 10], [20, 20], [30, 40]]);
    expect(root.querySelectorAll('path.stroke')).toHaveLength(2);
  });

  it('ignore les points trop proches et borne le trait à la zone', () => {
    const { drawn, stroke } = render();
    stroke([[10, 10], [10.1, 10.1], [200, -50]]);
    expect(drawn()[0]).toEqual([[10, 10], [109, 0]]);
  });

  it('ne dessine pas sans appui, ni avec un second doigt, ni verrouillé', () => {
    const { svg, drawn, flush } = render();
    svg.dispatchEvent(pointer('pointermove', 30, 30));
    svg.dispatchEvent(pointer('pointerdown', 30, 30, { isPrimary: false }));
    flush();
    expect(drawn()).toHaveLength(0);

    const locked = render(true);
    locked.svg.dispatchEvent(pointer('pointerdown', 30, 30));
    locked.flush();
    expect(locked.drawn()).toHaveLength(0);
    expect(locked.root.querySelector('button')).toBeNull();
  });

  it('annule le dernier trait et efface tout', () => {
    const { drawn, stroke, flush, root } = render();
    stroke([[10, 10], [20, 20]]);
    stroke([[30, 30], [40, 40]]);
    const [undo, clear] = Array.from(root.querySelectorAll('button'));
    undo.click();
    flush();
    expect(drawn()).toHaveLength(1);
    clear.click();
    flush();
    expect(drawn()).toHaveLength(0);
    expect(undo.disabled).toBe(true);
  });
});
