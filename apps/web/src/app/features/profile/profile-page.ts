import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  MAX_DAILY_GOAL,
  MIN_DAILY_GOAL,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '@kanadrill/shared';
import { AuthService } from '../../core/auth.service';

const PROVIDER_LABELS: Record<string, string> = { discord: 'Discord' };

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

        <section class="flex flex-col gap-3" aria-labelledby="connections-label">
          <h2 id="connections-label" class="text-lg font-medium">Connexions</h2>
          <ul class="divide-y divide-line border border-line bg-paper">
            @for (identity of user.identities; track identity.provider) {
              <li class="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-3">
                <span class="font-medium">{{ providerLabel(identity.provider) }}</span>
                <span class="text-sm text-ink-soft">
                  {{ identity.displayName }} · depuis le {{ identity.linkedAt | date: 'mediumDate' }}
                </span>
              </li>
            }
          </ul>
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
  }

  protected providerLabel(provider: string): string {
    return PROVIDER_LABELS[provider] ?? provider;
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

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }

  protected async deleteAccount(): Promise<void> {
    await this.auth.deleteAccount();
    await this.router.navigateByUrl('/login');
  }
}
