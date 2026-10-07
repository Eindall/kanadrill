import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  MAX_DAILY_GOAL,
  MIN_DAILY_GOAL,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  isAuthProvider,
  type AuthProvider,
  type SessionInfoDto,
} from '@kanadrill/shared';
import { AuthService } from '../../core/auth.service';
import { PROVIDERS, PROVIDER_LABELS } from '../../core/providers';
import { relativeTime } from '../../core/relative-time';
import { SessionsService } from '../../core/sessions.service';

const LINK_ERRORS: Record<string, string> = {
  conflict: 'Ce compte est déjà lié à un autre compte KanaDrill. Il n\'a pas été ajouté.',
  provider_taken: 'Un compte de ce service est déjà lié à ton profil.',
  session: 'La liaison a été annulée : ta session a changé entre-temps. Réessaie.',
  state: 'La liaison a expiré avant la fin. Réessaie.',
};

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    @if (auth.user(); as user) {
      <div class="flex flex-col gap-10">
        <section class="flex items-center gap-5">
          @if (user.avatarUrl) {
            <img [src]="user.avatarUrl" alt="" width="80" height="80" class="size-20 rounded-full bg-line" />
          } @else {
            <span class="size-20 rounded-full bg-line" aria-hidden="true"></span>
          }
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-semibold tracking-tight">{{ user.username }}</h1>
            <p class="text-sm text-ink-soft">Inscrit le {{ user.createdAt | date: 'longDate' }}</p>
          </div>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="username-label">
          <h2 id="username-label" class="text-lg font-medium">Pseudo</h2>
          <form class="flex flex-col gap-3 sm:flex-row" (submit)="saveUsername($event)">
            <input
              type="text"
              autocomplete="nickname"
              [formControl]="username"
              aria-labelledby="username-label"
              class="min-w-0 flex-1 border border-line bg-paper px-4 py-3 text-base"
            />
            <button
              type="submit"
              [disabled]="username.invalid || username.pristine || saving()"
              class="bg-ink px-6 py-3 font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enregistrer
            </button>
          </form>
          @if (username.dirty && username.invalid) {
            <p role="alert" class="text-sm text-seal">
              Entre {{ min }} et {{ max }} caractères : lettres, chiffres, espaces, points, tirets ou underscores.
            </p>
          }
          @if (saved()) {
            <p role="status" class="text-sm text-ink-soft">Pseudo enregistré.</p>
          }
          @if (saveError()) {
            <p role="alert" class="text-sm text-seal">{{ saveError() }}</p>
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="goal-label">
          <h2 id="goal-label" class="text-lg font-medium">Objectif quotidien</h2>
          <p class="text-sm text-ink-soft">
            Nombre de cartes que tu veux tenter chaque jour, réussies ou non. C'est un repère, pas une limite.
          </p>
          <form class="flex flex-col gap-3 sm:flex-row" (submit)="saveGoal($event)">
            <input
              type="number"
              inputmode="numeric"
              [min]="goalMin"
              [max]="goalMax"
              step="1"
              [formControl]="goal"
              aria-labelledby="goal-label"
              class="min-w-0 flex-1 border border-line bg-paper px-4 py-3 text-base"
            />
            <button
              type="submit"
              [disabled]="goal.invalid || goal.pristine || goalSaving()"
              class="bg-ink px-6 py-3 font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enregistrer
            </button>
          </form>
          @if (goal.dirty && goal.invalid) {
            <p role="alert" class="text-sm text-seal">Entre {{ goalMin }} et {{ goalMax }} cartes (un nombre entier).</p>
          }
          @if (goalSaved()) {
            <p role="status" class="text-sm text-ink-soft">Objectif enregistré.</p>
          }
          @if (goalError()) {
            <p role="alert" class="text-sm text-seal">{{ goalError() }}</p>
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="leaderboard-label">
          <h2 id="leaderboard-label" class="text-lg font-medium">Classement</h2>
          <p class="text-sm text-ink-soft">
            Le classement compare les séries de jours d'apprentissage des utilisateurs de KanaDrill : les autres y voient ton
            pseudo, ton avatar et ta série (jamais tes cartes ni tes réponses).
          </p>
          <label class="flex cursor-pointer items-center gap-3 border border-line bg-paper px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-seal">
            <input
              type="checkbox"
              class="size-5 accent-ink"
              [checked]="user.leaderboardVisible"
              [disabled]="leaderboardSaving()"
              (change)="setLeaderboardVisible($any($event.target).checked)"
            />
            <span class="font-medium">Apparaître dans le classement</span>
          </label>
          @if (leaderboardError()) {
            <p role="alert" class="text-sm text-seal">{{ leaderboardError() }}</p>
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="sessions-label">
          <h2 id="sessions-label" class="text-lg font-medium">Appareils connectés</h2>
          <p class="text-sm text-ink-soft">
            Tu restes connecté tant que tu t'en sers au moins une fois toutes les 48&nbsp;h, dans la limite de
            30&nbsp;jours d'affilée.
          </p>
          @if (sessionsError()) {
            <p role="alert" class="text-sm text-seal">{{ sessionsError() }}</p>
          }
          @if (sessions(); as list) {
            <ul class="divide-y divide-line border border-line bg-paper">
              @for (item of list; track item.id) {
                <li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                  <div class="min-w-0">
                    <p class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{ item.device }}</span>
                      @if (item.current) {
                        <span class="bg-ink px-2 py-0.5 text-xs font-medium text-paper">Cet appareil</span>
                      }
                    </p>
                    <p class="text-sm text-ink-soft">Dernière activité : {{ relative(item.lastUsedAt) }}</p>
                  </div>
                  @if (!item.current) {
                    <button
                      type="button"
                      (click)="revokeSession(item)"
                      [disabled]="sessionsBusy()"
                      class="text-sm text-seal underline underline-offset-4 disabled:opacity-40"
                    >
                      Déconnecter
                    </button>
                  }
                </li>
              }
            </ul>
            @if (list.length > 1) {
              <button
                type="button"
                (click)="revokeOtherSessions()"
                [disabled]="sessionsBusy()"
                class="self-start border border-ink px-5 py-2.5 font-medium transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
              >
                Déconnecter tous les autres appareils
              </button>
            }
          } @else if (!sessionsError()) {
            <p role="status" class="text-sm text-ink-soft">Chargement…</p>
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="connections-label">
          <h2 id="connections-label" class="text-lg font-medium">Connexions</h2>
          @if (linkNotice(); as notice) {
            <p role="status" class="border-l-4 border-ink bg-paper px-4 py-3 text-sm">{{ notice }}</p>
          }
          @if (linkProblem(); as problem) {
            <p role="alert" class="border-l-4 border-seal bg-paper px-4 py-3 text-sm">{{ problem }}</p>
          }
          <ul class="divide-y divide-line border border-line bg-paper">
            @for (identity of user.identities; track identity.provider) {
              <li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                <div class="min-w-0">
                  <p class="font-medium">{{ providerLabel(identity.provider) }}</p>
                  <p class="text-sm text-ink-soft">
                    {{ identity.displayName }} · depuis le {{ identity.linkedAt | date: 'mediumDate' }}
                  </p>
                </div>
                @if (user.identities.length > 1) {
                  <button
                    type="button"
                    (click)="unlink(identity.provider)"
                    [disabled]="linkBusy()"
                    class="text-sm text-seal underline underline-offset-4 disabled:opacity-40"
                  >
                    Dissocier
                  </button>
                } @else {
                  <span class="text-sm text-ink-soft">Seule connexion : elle ne peut pas être dissociée.</span>
                }
              </li>
            }
          </ul>
          @if (unlinked(); as missing) {
            <div class="flex flex-wrap gap-3">
              @for (provider of missing; track provider) {
                <button
                  type="button"
                  (click)="link(provider)"
                  [disabled]="linkBusy()"
                  class="border border-ink px-5 py-2.5 font-medium transition-colors hover:bg-ink hover:text-paper disabled:opacity-40"
                >
                  Lier {{ providerLabel(provider) }}
                </button>
              }
            </div>
          }
        </section>

        <section class="flex flex-col items-start gap-6 border-t border-line pt-8">
          <button
            type="button"
            (click)="logout()"
            class="border border-ink px-6 py-3 font-medium transition-colors hover:bg-ink hover:text-paper"
          >
            Se déconnecter
          </button>

          @if (!confirmingDelete()) {
            <button type="button" (click)="confirmingDelete.set(true)" class="text-sm text-seal underline underline-offset-4">
              Supprimer mon compte
            </button>
          } @else {
            <div role="alertdialog" aria-labelledby="delete-title" class="flex flex-col gap-3 border-l-4 border-seal bg-paper p-4">
              <p id="delete-title" class="font-medium">Supprimer définitivement ton compte ?</p>
              <p class="text-sm text-ink-soft">Ton profil et tous tes résultats de révision seront effacés. Cette action est irréversible.</p>
              <div class="flex gap-3">
                <button type="button" (click)="deleteAccount()" class="bg-seal px-5 py-2.5 font-medium text-paper hover:bg-seal-dark">
                  Supprimer mon compte
                </button>
                <button type="button" (click)="confirmingDelete.set(false)" class="px-5 py-2.5 font-medium">Annuler</button>
              </div>
            </div>
          }
        </section>
      </div>
    }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sessionsApi = inject(SessionsService);

  /** Retour d'une liaison (`?linked=google` ou `?link_error=conflict`), via les paramètres d'URL. */
  readonly linked = input<string>();
  readonly linkError = input<string>(undefined, { alias: 'link_error' });
  protected readonly linkNotice = computed(() => {
    const provider = this.linked();
    return isAuthProvider(provider) ? `${PROVIDER_LABELS[provider]} est maintenant lié à ton compte.` : null;
  });
  protected readonly linkProblem = computed(() => {
    const code = this.linkError();
    return code ? (LINK_ERRORS[code] ?? "La liaison n'a pas abouti. Réessaie.") : this.linkFailure();
  });
  protected readonly linkFailure = signal<string | null>(null);
  protected readonly linkBusy = signal(false);
  /** Fournisseurs pas encore liés au compte (vide : rien à proposer). */
  protected readonly unlinked = computed(() => {
    const linked = new Set(this.auth.user()?.identities.map((identity) => identity.provider));
    const missing = PROVIDERS.filter((provider) => !linked.has(provider));
    return missing.length > 0 ? missing : null;
  });

  protected readonly min = USERNAME_MIN_LENGTH;
  protected readonly max = USERNAME_MAX_LENGTH;

  protected readonly username = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(USERNAME_MIN_LENGTH),
      Validators.maxLength(USERNAME_MAX_LENGTH),
      Validators.pattern(USERNAME_PATTERN),
    ],
  });

  protected readonly goalMin = MIN_DAILY_GOAL;
  protected readonly goalMax = MAX_DAILY_GOAL;
  protected readonly goal = new FormControl<number>(0, {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.min(MIN_DAILY_GOAL),
      Validators.max(MAX_DAILY_GOAL),
      Validators.pattern(/^\d+$/),
    ],
  });
  protected readonly goalSaving = signal(false);
  protected readonly goalSaved = signal(false);
  protected readonly goalError = signal<string | null>(null);
  protected readonly leaderboardSaving = signal(false);
  protected readonly leaderboardError = signal<string | null>(null);

  protected readonly sessions = signal<SessionInfoDto[] | null>(null);
  protected readonly sessionsError = signal<string | null>(null);
  protected readonly sessionsBusy = signal(false);

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);

  constructor() {
    // Initialise le champ avec le pseudo courant (une seule fois, tant que l'utilisateur n'a rien tapé).
    effect(() => {
      const user = this.auth.user();
      if (user && this.username.pristine) {
        this.username.setValue(user.username);
      }
      if (user && this.goal.pristine) {
        this.goal.setValue(user.dailyGoal);
      }
    });
    void this.loadSessions();
  }

  protected providerLabel(provider: string): string {
    return isAuthProvider(provider) ? PROVIDER_LABELS[provider] : provider;
  }

  protected async link(provider: AuthProvider): Promise<void> {
    this.linkBusy.set(true);
    this.linkFailure.set(null);
    try {
      window.location.assign(await this.auth.startLink(provider));
    } catch {
      this.linkFailure.set("La liaison n'a pas pu démarrer. Réessaie.");
      this.linkBusy.set(false);
    }
  }

  protected async unlink(provider: AuthProvider): Promise<void> {
    this.linkBusy.set(true);
    this.linkFailure.set(null);
    try {
      await this.auth.unlink(provider);
    } catch {
      this.linkFailure.set("La connexion n'a pas pu être dissociée (une connexion au moins doit rester).");
    } finally {
      this.linkBusy.set(false);
    }
  }

  protected async saveUsername(event: Event): Promise<void> {
    // Un <form> sans NgForm (ReactiveFormsModule seul) soumettrait la page nativement : on l'empêche.
    event.preventDefault();
    if (this.username.invalid || this.username.pristine) return;
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);
    try {
      await this.auth.updateUsername(this.username.value.trim());
      this.username.markAsPristine();
      this.saved.set(true);
    } catch {
      this.saveError.set("Le pseudo n'a pas pu être enregistré. Réessaie.");
    } finally {
      this.saving.set(false);
    }
  }

  protected async setLeaderboardVisible(visible: boolean): Promise<void> {
    this.leaderboardSaving.set(true);
    this.leaderboardError.set(null);
    try {
      await this.auth.updateLeaderboardVisible(visible);
    } catch {
      this.leaderboardError.set("Le réglage n'a pas pu être enregistré. Réessaie.");
    } finally {
      this.leaderboardSaving.set(false);
    }
  }

  protected async saveGoal(event: Event): Promise<void> {
    event.preventDefault();
    if (this.goal.invalid || this.goal.pristine) return;
    this.goalSaving.set(true);
    this.goalSaved.set(false);
    this.goalError.set(null);
    try {
      await this.auth.updateDailyGoal(Number(this.goal.value));
      this.goal.markAsPristine();
      this.goalSaved.set(true);
    } catch {
      this.goalError.set("L'objectif n'a pas pu être enregistré. Réessaie.");
    } finally {
      this.goalSaving.set(false);
    }
  }

  protected relative(date: string): string {
    return relativeTime(date);
  }

  private async loadSessions(): Promise<void> {
    try {
      this.sessions.set(await this.sessionsApi.list());
      this.sessionsError.set(null);
    } catch {
      this.sessionsError.set('Impossible de charger la liste des appareils.');
    }
  }

  protected async revokeSession(session: SessionInfoDto): Promise<void> {
    await this.runSessionAction(() => this.sessionsApi.revoke(session.id));
  }

  protected async revokeOtherSessions(): Promise<void> {
    await this.runSessionAction(() => this.sessionsApi.revokeOthers());
  }

  private async runSessionAction(action: () => Promise<void>): Promise<void> {
    this.sessionsBusy.set(true);
    try {
      await action();
    } catch {
      this.sessionsError.set("L'appareil n'a pas pu être déconnecté. Réessaie.");
    } finally {
      this.sessionsBusy.set(false);
    }
    await this.loadSessions();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  protected async deleteAccount(): Promise<void> {
    await this.auth.deleteAccount();
    await this.router.navigateByUrl('/login');
  }
}
