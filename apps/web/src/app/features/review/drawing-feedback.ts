import { DRAWING_ANSWERS, type DrawingIssue, type DrawingScore } from '@kanadrill/shared';

export type DrawingAnswer = (typeof DRAWING_ANSWERS)[keyof typeof DRAWING_ANSWERS];

/** Le verdict de la comparaison, proposé comme réponse (l'utilisateur peut en choisir une autre). */
export function suggestedAnswer(score: DrawingScore): DrawingAnswer {
  if (score.verdict === 'good') return DRAWING_ANSWERS.correct;
  return score.verdict === 'fair' ? DRAWING_ANSWERS.fair : DRAWING_ANSWERS.wrong;
}

export const VERDICT_TITLES: Record<DrawingScore['verdict'], string> = {
  good: 'Tracé juste',
  fair: 'Presque',
  wrong: 'À revoir',
};

function describeIssue(issue: DrawingIssue): string {
  switch (issue.type) {
    case 'strokeCount':
      return issue.actual === 0
        ? `Il faut ${issue.expected} ${issue.expected > 1 ? 'traits' : 'trait'}.`
        : `Tu as tracé ${issue.actual} ${issue.actual > 1 ? 'traits' : 'trait'}, le modèle en compte ${issue.expected}.`;
    case 'tooSmall':
      return 'Le dessin est trop petit pour être comparé : dessine plus grand.';
    case 'order':
      return `Le trait ${issue.stroke + 1} n'est pas à sa place dans l'ordre.`;
    case 'direction':
      return `Le trait ${issue.stroke + 1} est tracé dans le mauvais sens.`;
    case 'shape':
      return `Le trait ${issue.stroke + 1} s'éloigne du modèle.`;
  }
}

/** Explications affichées sous la comparaison, en français. */
export function describeScore(score: DrawingScore): string[] {
  const far = score.issues.filter((issue) => issue.type === 'shape').map(describeIssue);
  if (score.verdict === 'good') return ['Les formes, l\'ordre et le sens des traits sont corrects.', ...far];
  if (score.verdict === 'fair') {
    return ['Bon ordre et bon sens, mais certaines formes restent approximatives : compare avec le modèle.', ...far];
  }
  return score.issues.map(describeIssue);
}
