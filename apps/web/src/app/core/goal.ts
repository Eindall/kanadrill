/** Avancement de l'objectif quotidien, en % (0–100, plafonné : on peut dépasser l'objectif). */
export function goalProgress(answersToday: number, dailyGoal: number): number {
  if (dailyGoal <= 0) return 0;
  return Math.min(100, Math.round((answersToday / dailyGoal) * 100));
}
