import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { STATS_PERIODS, type StatsDto, type StatsOverviewDto } from '@kanadrill/shared';
import { StatsService, type StatsRange } from '../../core/stats.service';
import { BarChart, type BarDatum } from './bar-chart';
import { ChartCard, type ChartTable } from './chart-card';
import { FlameIcon } from './flame-icon';
import { LineChart, type LinePoint } from './line-chart';
import { MasteryChart, type MasteryRow } from './mastery-chart';
import { StreakTimeline } from './streak-timeline';
import { bucketActivity, bucketSize, longDay, shortDay, successRate, toIsoDay } from './stats-helpers';

const PERIOD_LABELS: Record<number, string> = { 7: '7 jours', 30: '30 jours', 90: '90 jours', 180: '6 mois', 365: '1 an' };
const KANJI_LEVEL_LABELS: Record<string, string> = { N5: 'Kanji N5', N4: 'Kanji N4', N3: 'Kanji N3', N2: 'Kanji N2', N1: 'Kanji N1', other: 'Kanji autres' };
const KANJI_LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1', 'other'];

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

@Component({
  selector: 'app-stats-page',
  imports: [RouterLink, DecimalPipe, BarChart, LineChart, MasteryChart, ChartCard, StreakTimeline, FlameIcon],
  template: `
    <section class="flex flex-col gap-6">
      <h1 class="text-2xl font-semibold tracking-tight">Statistiques</h1>

      <!-- Un seul bandeau de filtres, au-dessus de tout ce qu'il règle -->
      <div class="flex flex-col gap-3" role="group" aria-label="Période">
        <div class="flex flex-wrap gap-2">
          @for (period of periods; track period) {
            <button
              type="button"
              (click)="selectPeriod(period)"
              [attr.aria-pressed]="!isCustom() && currentDays() === period"
              class="border px-3 py-2 text-sm font-medium"
              [class]="!isCustom() && currentDays() === period ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'"
            >
              {{ periodLabels[period] }}
            </button>
          }
          <button
            type="button"
            (click)="customOpen.set(!customOpen())"
            [attr.aria-pressed]="isCustom()"
            [attr.aria-expanded]="customOpen()"
            class="border px-3 py-2 text-sm font-medium"
            [class]="isCustom() ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'"
          >
            Dates…
          </button>
        </div>
        @if (customOpen() || isCustom()) {
          <form class="flex flex-wrap items-end gap-3" (submit)="applyCustom($event)">
            <label class="flex flex-col gap-1 text-sm text-ink-soft">
              Du
              <input type="date" [value]="fromDraft()" [max]="todayIso()" (input)="fromDraft.set($any($event.target).value)" class="border border-line bg-paper px-3 py-2 text-base text-ink" />
            </label>
            <label class="flex flex-col gap-1 text-sm text-ink-soft">
              Au
              <input type="date" [value]="toDraft()" [max]="todayIso()" (input)="toDraft.set($any($event.target).value)" class="border border-line bg-paper px-3 py-2 text-base text-ink" />
            </label>
            <button type="submit" [disabled]="!customValid()" class="bg-ink px-5 py-2.5 font-medium text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40">
              Afficher
            </button>
          </form>
          @if (!customValid() && fromDraft()) {
            <p role="alert" class="text-sm text-seal">Choisis une date de début qui précède la date de fin (730 jours au plus).</p>
          }
        }
      </div>

      @if (error()) {
        <p role="alert" class="text-seal">{{ error() }}</p>
      }

      @if (stats(); as s) {
        <div class="flex flex-col gap-6 transition-opacity" [class.opacity-60]="loading()">
          <p class="text-sm text-ink-soft">Du {{ longDayFn(s.from) }} au {{ longDayFn(s.to) }}.</p>

          <!-- Série et 7 derniers jours -->
          <section class="flex flex-col gap-4 border border-line bg-paper p-4" aria-labelledby="streak-title">
            @if (overview(); as o) {
              <div class="flex items-center gap-4">
                <span class="size-12 shrink-0" [class]="o.streak.current > 0 ? 'text-ink' : 'text-line'"><app-flame-icon /></span>
                <div>
                  <h2 id="streak-title" class="text-3xl font-semibold leading-none">{{ plural(o.streak.current, 'jour', 'jours') }}</h2>
                  <p class="text-sm text-ink-soft">
                    de série · record : {{ plural(o.streak.longest, 'jour', 'jours') }}
                  </p>
                </div>
              </div>
              <app-streak-timeline [days]="o.recent" [goal]="o.dailyGoal" />
              @if (o.streak.current > 0 && !o.streak.activeToday) {
                <p class="text-sm text-ink-soft">Réponds à une carte aujourd'hui pour garder ta série.</p>
              }
            }
          </section>

          <dl class="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Réponses</dt>
              <dd class="text-3xl font-semibold">{{ s.totals.answers | number: '1.0-0' : 'fr' }}</dd>
            </div>
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Réussite</dt>
              <dd class="text-3xl font-semibold">{{ rate(s) === null ? '—' : rate(s) + ' %' }}</dd>
            </div>
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Jours actifs</dt>
              <dd class="text-3xl font-semibold">{{ s.totals.activeDays }}<span class="text-lg font-normal text-ink-soft"> / {{ s.days.length }}</span></dd>
            </div>
            <div class="bg-paper p-4">
              <dt class="text-sm text-ink-soft">Éléments travaillés</dt>
              <dd class="text-3xl font-semibold">{{ s.totals.distinctItems }}</dd>
            </div>
          </dl>

          <app-chart-card
            title="Activité"
            [subtitle]="activitySubtitle()"
            [table]="activityTable()"
            [loading]="loading()"
          >
            <app-bar-chart
              [bars]="activityBars()"
              [goal]="activityGoal()"
              ariaLabel="Réponses par période"
            />
            @if (activityGoal() !== null) {
              <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span class="inline-flex items-center gap-1.5"><span class="size-3 bg-ink-faint"></span>sous l'objectif</span>
                <span class="inline-flex items-center gap-1.5"><span class="size-3 bg-ok"></span>objectif atteint</span>
                <span class="inline-flex items-center gap-1.5"><span class="h-0 w-4 border-t border-ink"></span>objectif quotidien ({{ s.dailyGoal }})</span>
              </p>
            }
          </app-chart-card>

          <app-chart-card
            title="Réussite"
            subtitle="Part des réponses réussies (note Hard ou mieux)."
            [table]="successTable()"
            [loading]="loading()"
          >
            <app-line-chart [points]="successPoints()" ariaLabel="Taux de réussite par période" />
          </app-chart-card>

          <app-chart-card
            title="Maîtrise"
            subtitle="Où en est chaque jeu de cartes (état actuel, indépendant de la période)."
            [table]="masteryTable()"
            [loading]="loading()"
          >
            <app-mastery-chart [rows]="masteryRows()" />
            @if (s.mastery.kanji && !hasKanji()) {
              <p class="mt-3 text-sm text-ink-soft">
                Aucun kanji dans ton dictionnaire pour l'instant.
                <a routerLink="/learn" [queryParams]="{ tab: 'kanji' }" class="underline underline-offset-4">En ajouter</a>
              </p>
            }
          </app-chart-card>

          <app-chart-card
            title="Prévision"
            subtitle="Cartes à revoir sur les 14 prochains jours (aujourd'hui : retards compris)."
            [table]="forecastTable()"
            [loading]="loading()"
          >
            <app-bar-chart [bars]="forecastBars()" ariaLabel="Cartes à revoir par jour" hint="Survole ou touche une barre pour voir le détail." />
          </app-chart-card>

          <section class="flex flex-col gap-3 border border-line bg-paper p-4" aria-labelledby="weak-title">
            <div>
              <h2 id="weak-title" class="text-lg font-medium">À retravailler</h2>
              <p class="text-sm text-ink-soft">Les cartes les plus ratées pendant la période.</p>
            </div>
            @if (s.weakest.length > 0) {
              <ol class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                @for (item of s.weakest; track item.id) {
                  <li>
                    <a
                      [routerLink]="['/learn', item.id]"
                      class="flex items-center gap-4 border border-line px-4 py-3 hover:border-ink"
                    >
                      <span class="font-kana text-3xl leading-none" lang="ja">{{ item.character }}</span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate">{{ item.label }}</span>
                        <span class="text-sm text-ink-soft">{{ item.misses }} {{ item.misses > 1 ? 'ratés' : 'raté' }} sur {{ item.answers }}</span>
                      </span>
                    </a>
                  </li>
                }
              </ol>
            } @else {
              <p class="text-ink-soft">Aucune carte ratée sur cette période.</p>
            }
          </section>
        </div>
      } @else if (!error()) {
        <p role="status" class="text-ink-soft">Chargement…</p>
      }
    </section>
  `,
})
export class StatsPage {
  private readonly api = inject(StatsService);
  private readonly router = inject(Router);

  /** Paramètres d'URL (liés par `withComponentInputBinding`) : `?days=30` ou `?from=2026-09-01&to=2026-09-30`. */
  readonly days = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();

  protected readonly periods = STATS_PERIODS;
  protected readonly periodLabels = PERIOD_LABELS;
  protected readonly plural = plural;
  protected readonly longDayFn = longDay;

  protected readonly stats = signal<StatsDto | null>(null);
  protected readonly overview = signal<StatsOverviewDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly customOpen = signal(false);
  protected readonly fromDraft = signal('');
  protected readonly toDraft = signal('');
  private request = 0;

  protected readonly isCustom = computed(() => !!this.from());
  protected readonly currentDays = computed(() => {
    const days = Number(this.days());
    return (STATS_PERIODS as readonly number[]).includes(days) ? days : 30;
  });
  protected readonly range = computed<StatsRange>(() => (this.from() ? { from: this.from() as string, to: this.to() || undefined } : { days: this.currentDays() }));
  protected readonly todayIso = computed(() => this.stats()?.today ?? toIsoDay(new Date()));
  protected readonly customValid = computed(() => {
    const from = this.fromDraft();
    const to = this.toDraft() || this.todayIso();
    if (!from || from > to || to > this.todayIso()) return false;
    return (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 <= 731;
  });

  constructor() {
    this.api.loadOverview().then(
      (overview) => this.overview.set(overview),
      () => undefined, // la série est un confort : le reste de la page s'affiche sans
    );
    effect(() => {
      const range = this.range();
      void this.load(range);
    });
    // Les champs de dates reprennent la plage affichée.
    effect(() => {
      const stats = this.stats();
      if (stats && this.isCustom()) {
        this.fromDraft.set(stats.from);
        this.toDraft.set(stats.to);
      }
    });
  }

  private async load(range: StatsRange): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set(null);
    try {
      const stats = await this.api.loadStats(range);
      if (request === this.request) this.stats.set(stats);
    } catch {
      if (request === this.request) this.error.set('Impossible de charger les statistiques pour cette période.');
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  protected selectPeriod(days: number): void {
    this.customOpen.set(false);
    void this.router.navigate([], { queryParams: { days, from: null, to: null }, replaceUrl: true });
  }

  protected applyCustom(event: Event): void {
    event.preventDefault();
    if (!this.customValid()) return;
    void this.router.navigate([], { queryParams: { days: null, from: this.fromDraft(), to: this.toDraft() || null }, replaceUrl: true });
  }

  protected rate(stats: StatsDto): number | null {
    return successRate(stats.totals.answers, stats.totals.correct);
  }

  // --- Activité ------------------------------------------------------------------------------------------------
  private readonly buckets = computed(() => bucketActivity(this.stats()?.days ?? []));
  private readonly size = computed(() => bucketSize(this.stats()?.days.length ?? 0));

  protected readonly activityGoal = computed(() => (this.size() === 'day' ? (this.stats()?.dailyGoal ?? null) : null));
  protected readonly activitySubtitle = computed(() => {
    const unit = { day: 'jour', week: 'semaine', month: 'mois' }[this.size()];
    return `Cartes tentées par ${unit}, réussies ou non.`;
  });
  protected readonly activityBars = computed((): BarDatum[] => {
    const goal = this.stats()?.dailyGoal ?? 0;
    const daily = this.size() === 'day';
    return this.buckets().map((bucket) => ({
      label: bucket.label,
      value: bucket.answers,
      tone: !daily ? 'base' : bucket.answers >= goal ? 'good' : 'muted',
      readout: `${bucket.title} : ${plural(bucket.answers, 'carte', 'cartes')}${
        bucket.answers > 0 ? ` (${bucket.correct} réussies)` : ''
      }${daily && bucket.answers >= goal ? ' · objectif atteint' : ''}`,
    }));
  });
  protected readonly activityTable = computed((): ChartTable => ({
    head: ['Période', 'Cartes', 'Réussies', 'Réussite'],
    rows: this.buckets().map((b) => [b.title, b.answers, b.correct, this.percent(b.answers, b.correct)]),
  }));

  // --- Réussite ------------------------------------------------------------------------------------------------
  protected readonly successPoints = computed((): LinePoint[] =>
    this.buckets().map((bucket) => {
      const value = successRate(bucket.answers, bucket.correct);
      return {
        label: bucket.label,
        value,
        readout:
          value === null
            ? `${bucket.title} : aucune réponse`
            : `${bucket.title} : ${value} % de réussite (${bucket.correct} sur ${bucket.answers})`,
      };
    }),
  );
  protected readonly successTable = computed((): ChartTable => ({
    head: ['Période', 'Cartes', 'Réussite'],
    rows: this.buckets().map((b) => [b.title, b.answers, this.percent(b.answers, b.correct)]),
  }));

  private percent(answers: number, correct: number): string {
    const value = successRate(answers, correct);
    return value === null ? '—' : `${value} %`;
  }

  // --- Maîtrise ------------------------------------------------------------------------------------------------
  protected readonly masteryRows = computed((): MasteryRow[] => {
    const mastery = this.stats()?.mastery;
    if (!mastery) return [];
    const kanji = KANJI_LEVEL_ORDER.filter((level) => mastery.kanji[level as keyof typeof mastery.kanji]).map((level) => ({
      label: KANJI_LEVEL_LABELS[level],
      counts: mastery.kanji[level as keyof typeof mastery.kanji]!,
    }));
    return [
      { label: 'Hiragana', counts: mastery.hiragana },
      { label: 'Katakana', counts: mastery.katakana },
      ...kanji,
    ];
  });
  protected readonly hasKanji = computed(() => Object.keys(this.stats()?.mastery.kanji ?? {}).length > 0);
  protected readonly masteryTable = computed((): ChartTable => ({
    head: ['Jeu de cartes', 'Solides', 'Connus', 'En cours', 'Pas encore vus'],
    rows: this.masteryRows().map((row) => [row.label, row.counts.mastered, row.counts.known, row.counts.learning, row.counts.unseen]),
  }));

  // --- Prévision -----------------------------------------------------------------------------------------------
  protected readonly forecastBars = computed((): BarDatum[] =>
    (this.stats()?.forecast ?? []).map((day, index) => ({
      label: index === 0 ? 'Auj.' : shortDay(day.date),
      value: day.due,
      readout: `${longDay(day.date)} : ${plural(day.due, 'carte', 'cartes')} à revoir${index === 0 ? ' (retards compris)' : ''}`,
    })),
  );
  protected readonly forecastTable = computed((): ChartTable => ({
    head: ['Jour', 'Cartes à revoir'],
    rows: (this.stats()?.forecast ?? []).map((day, index) => [index === 0 ? `${longDay(day.date)} (retards compris)` : longDay(day.date), day.due]),
  }));
}
