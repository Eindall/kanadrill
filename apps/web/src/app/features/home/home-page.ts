import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home-page',
  template: `
    <section class="flex flex-col gap-8">
      <h1 class="text-2xl font-semibold tracking-tight">Bonjour {{ auth.user()?.username }}</h1>

      <div class="flex flex-col gap-4 border border-line bg-paper p-6">
        <p class="font-kana text-5xl leading-none" aria-hidden="true">ひらがな</p>
        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-medium">Aucune révision pour l'instant</h2>
          <p class="max-w-prose text-ink-soft">
            Les premiers exercices sur les hiragana arrivent. Ton compte est prêt : tes résultats seront
            enregistrés dès la première session.
          </p>
        </div>
      </div>
    </section>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
}
