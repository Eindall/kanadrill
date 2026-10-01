import type { Card } from 'ts-fsrs';
import { UserItem } from './user-item.entity';

/** Convertit l'état en base d'un item en carte ts-fsrs. */
export function toCard(userItem: UserItem): Card {
  return {
    due: userItem.due,
    stability: userItem.stability,
    difficulty: userItem.difficulty,
    elapsed_days: userItem.elapsedDays,
    scheduled_days: userItem.scheduledDays,
    learning_steps: userItem.learningSteps,
    reps: userItem.reps,
    lapses: userItem.lapses,
    state: userItem.state,
    last_review: userItem.lastReview ?? undefined,
  };
}

/** Recopie une carte ts-fsrs dans l'entité (après une révision). */
export function applyCard(userItem: UserItem, card: Card): void {
  userItem.due = card.due;
  userItem.stability = card.stability;
  userItem.difficulty = card.difficulty;
  userItem.elapsedDays = card.elapsed_days;
  userItem.scheduledDays = card.scheduled_days;
  userItem.learningSteps = card.learning_steps;
  userItem.reps = card.reps;
  userItem.lapses = card.lapses;
  userItem.state = card.state;
  userItem.lastReview = card.last_review ?? null;
}
