import { Component, computed, input } from '@angular/core';

const ERROR_MESSAGES: Record<string, string> = {
  state: 'La connexion a expiré avant la fin. Réessaie.',
  discord: "Discord n'a pas validé la connexion. Réessaie dans un instant.",
};

@Component({
  selector: 'app-login-page',
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-12">
      <div class="relative size-44 shrink-0 self-start" aria-hidden="true">
        <div
          class="font-kana flex size-40 items-center justify-center border-2 border-ink bg-paper text-[7.5rem] leading-none"
        >
          あ
        </div>
        <div
          class="font-kana absolute right-0 bottom-0 flex size-14 rotate-[-5deg] items-center justify-center bg-seal text-3xl leading-none text-paper"
        >
          覚
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h1 class="text-3xl font-semibold tracking-tight">KanaDrill</h1>
        <p class="max-w-prose text-lg text-ink-soft">
          Révise tes kana, puis tes kanjis, un peu chaque jour.
        </p>
      </div>

      <div class="flex flex-col gap-4">
        @if (errorMessage(); as message) {
          <p role="alert" class="border-l-4 border-seal bg-paper px-4 py-3 text-sm">{{ message }}</p>
        }

        <a
          href="/api/auth/discord"
          class="bg-ink px-6 py-3.5 text-center text-base font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Se connecter avec Discord
        </a>
        <p class="text-sm text-ink-soft">
          Seuls ton pseudo et ton avatar Discord sont utilisés. Aucune adresse e-mail n'est demandée.
        </p>
      </div>
    </main>
  `,
})
export class LoginPage {
  /** Alimenté par le paramètre d'URL `?error=` grâce à `withComponentInputBinding()`. */
  readonly error = input<string>();
  protected readonly errorMessage = computed(() => {
    const code = this.error();
    return code ? (ERROR_MESSAGES[code] ?? 'La connexion a échoué. Réessaie.') : null;
  });
}
