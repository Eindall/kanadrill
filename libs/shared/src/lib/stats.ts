import type { ItemType, KanjiLevel, MasteryLevel } from './learning';

/** Un jour au format `AAAA-MM-JJ`, dans le fuseau de l'application (`APP_TIMEZONE`). */
export type IsoDay = string;

/** Séries de jours d'apprentissage : un jour compte dès qu'on répond à une carte (réussie ou non). */
export interface StreakDto {
  /** Jours consécutifs jusqu'à aujourd'hui ; si on n'a pas encore répondu aujourd'hui, jusqu'à hier (rien n'est perdu avant minuit). */
  current: number;
  longest: number;
  activeToday: boolean;
}

export interface DayActivityDto {
  date: IsoDay;
  /** Réponses données ce jour-là, réussies ou non. */
  answers: number;
  /** Dont réussies (note Hard ou mieux). */
  correct: number;
}

/** Ce que l'accueil affiche : la série, et les 7 derniers jours face à l'objectif. */
export interface StatsOverviewDto {
  today: IsoDay;
  dailyGoal: number;
  streak: StreakDto;
  /** Les 7 derniers jours, du plus ancien à aujourd'hui. */
  recent: DayActivityDto[];
}

/** Périodes proposées par le sélecteur (en jours, jusqu'à aujourd'hui). */
export const STATS_PERIODS = [7, 30, 90, 180, 365] as const;
export const DEFAULT_STATS_PERIOD = 30;
/** Plage personnalisée : au plus ce nombre de jours. */
export const MAX_STATS_RANGE_DAYS = 731;
export const FORECAST_DAYS = 14;
export const WEAKEST_COUNT = 10;

export interface StatsTotalsDto {
  answers: number;
  correct: number;
  /** Jours de la période où l'on a répondu à au moins une carte. */
  activeDays: number;
  /** Éléments différents travaillés pendant la période. */
  distinctItems: number;
}

/** Répartition de la maîtrise (`unseen` : jamais répondu). */
export type MasteryCounts = Record<MasteryLevel, number>;

export interface MasteryStatsDto {
  hiragana: MasteryCounts;
  katakana: MasteryCounts;
  /** Kanji du dictionnaire, par niveau JLPT (les niveaux sans kanji dans le dictionnaire sont absents). */
  kanji: Partial<Record<KanjiLevel, MasteryCounts>>;
}

export interface WeakItemDto {
  id: string;
  type: ItemType;
  character: string;
  /** Lecture (kana) ou premier sens (kanji). */
  label: string;
  /** Réponses pendant la période, dont ratées. */
  answers: number;
  misses: number;
}

export interface ForecastDayDto {
  date: IsoDay;
  due: number;
}

export interface StatsDto {
  from: IsoDay;
  to: IsoDay;
  today: IsoDay;
  dailyGoal: number;
  /** Chaque jour de la période, y compris ceux sans réponse. */
  days: DayActivityDto[];
  totals: StatsTotalsDto;
  streak: StreakDto;
  /** État actuel (indépendant de la période). */
  mastery: MasteryStatsDto;
  /** Les éléments les plus ratés pendant la période. */
  weakest: WeakItemDto[];
  /** Cartes à revoir sur les prochains jours ; le premier jour compte aussi les cartes en retard. */
  forecast: ForecastDayDto[];
}

export interface LeaderboardEntryDto {
  /** Rang (1 = la plus longue série) ; deux utilisateurs à égalité partagent leur rang. */
  rank: number;
  username: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  isMe: boolean;
}

export interface LeaderboardDto {
  /** Les meilleures séries en cours (au moins un jour). */
  entries: LeaderboardEntryDto[];
  /** L'utilisateur lui-même, qu'il figure ou non dans la liste. */
  me: { rank: number | null; currentStreak: number; longestStreak: number; visible: boolean };
  /** Nombre d'utilisateurs classés. */
  total: number;
}

export const LEADERBOARD_SIZE = 50;

/** Les classements de la semaine (remis à zéro chaque lundi, dans `APP_TIMEZONE`). */
export const WEEKLY_METRICS = ['answers', 'drawing'] as const;
export type WeeklyMetric = (typeof WEEKLY_METRICS)[number];

export interface WeeklyEntryDto {
  /** Rang (1 = le plus de points) ; deux utilisateurs à égalité partagent leur rang. */
  rank: number;
  username: string;
  avatarUrl: string | null;
  /** `answers` : réponses de la semaine ; `drawing` : points de tracé (somme des précisions des tracés réussis). */
  value: number;
  /** `answers` : taux de réussite en % ; `drawing` : nombre de tracés faits (réussis ou non). */
  detail: number;
  isMe: boolean;
}

/** Classement de la semaine en cours : réponses données (toutes cartes) ou points de tracé. */
export interface WeeklyLeaderboardDto {
  metric: WeeklyMetric;
  /** Lundi de la semaine, et lundi suivant (remise à zéro), `AAAA-MM-JJ`. */
  weekStart: IsoDay;
  nextWeekStart: IsoDay;
  entries: WeeklyEntryDto[];
  /** L'utilisateur lui-même, qu'il figure ou non dans la liste. */
  me: { rank: number | null; value: number; detail: number; visible: boolean };
  /** Nombre d'utilisateurs classés. */
  total: number;
}
