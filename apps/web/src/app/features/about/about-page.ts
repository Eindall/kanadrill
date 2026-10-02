import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about-page',
  imports: [RouterLink],
  template: `
    <section class="flex flex-col gap-6">
      <a routerLink="/" class="self-start text-sm text-ink-soft underline underline-offset-4 hover:text-ink">← Accueil</a>
      <h1 class="text-2xl font-semibold tracking-tight">À propos</h1>

      <p>
        KanaDrill est une application de révision du japonais : kana d'abord, puis kanji, avec une répétition espacée
        (algorithme FSRS) pour réviser au bon moment.
      </p>

      <section class="flex flex-col gap-3" aria-labelledby="licences">
        <h2 id="licences" class="text-lg font-medium">Données et licences</h2>
        <ul class="flex flex-col gap-4">
          <li class="flex flex-col gap-1 border border-line bg-paper p-4">
            <span class="font-medium">KanjiVG : ordre des traits</span>
            <span class="text-sm text-ink-soft">
              Les tracés des kana et des kanji viennent de
              <a class="underline underline-offset-4" href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>,
              © Ulrich Apel, distribué sous licence
              <a class="underline underline-offset-4" href="https://creativecommons.org/licenses/by-sa/3.0/deed.fr" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
              Les tracés affichés ici en sont dérivés (mise à l'échelle et assemblage des yōon) et restent sous cette licence.
            </span>
          </li>
          <li class="flex flex-col gap-1 border border-line bg-paper p-4">
            <span class="font-medium">KANJIDIC2 : lectures et sens des kanji</span>
            <span class="text-sm text-ink-soft">
              Les lectures on et kun, les sens (en français quand ils existent, sinon en anglais), le niveau scolaire et la
              fréquence des kanji viennent de KANJIDIC2, fichier du
              <a class="underline underline-offset-4" href="https://www.edrdg.org/" target="_blank" rel="noopener">groupe EDRDG</a>,
              distribué sous
              <a class="underline underline-offset-4" href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noopener">licence EDRDG</a>.
            </span>
          </li>
          <li class="flex flex-col gap-1 border border-line bg-paper p-4">
            <span class="font-medium">Niveaux JLPT (N5 à N1)</span>
            <span class="text-sm text-ink-soft">
              Les listes de kanji par niveau sont celles de
              <a class="underline underline-offset-4" href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noopener">Jonathan Waller</a>
              (le JLPT n'en publie plus d'officielles), reprises dans le dépôt
              <a class="underline underline-offset-4" href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noopener">kanji-data</a>
              de David Gouveia (licence MIT). Ce sont des listes indicatives, pas un classement officiel.
            </span>
          </li>
        </ul>
      </section>
    </section>
  `,
})
export class AboutPage {}
