import { Component } from '@angular/core';

/**
 * Le logo de KanaDrill, le même que le favicon et que la page de connexion : un « あ » dans un carré à bordure encre,
 * avec le petit tampon rouge en coin. Ce n'est pas un lien (« Accueil » est dans le menu) et l'image ne se sélectionne
 * pas : pas de surlignage ni de glisser-déposer en touchant le logo.
 */
@Component({
  selector: 'app-logo',
  template: `
    <span class="relative inline-block size-10 shrink-0">
      <span class="font-kana flex size-9 items-center justify-center border-2 border-ink bg-paper text-[1.7rem] font-bold leading-none">あ</span>
      <span class="absolute right-0 bottom-0 size-3.5 rotate-[-5deg] bg-seal"></span>
    </span>
  `,
  host: { class: 'inline-flex select-none', role: 'img', 'aria-label': 'KanaDrill' },
})
export class Logo {}
