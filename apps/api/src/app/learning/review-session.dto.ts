import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateBy } from 'class-validator';
import {
  MAX_DRAWING_POINTS,
  MAX_DRAWING_STROKE_POINTS,
  MAX_DRAWING_STROKES,
  MAX_REVIEW_DURATION_MS,
  REVIEW_MODES,
  type Point2D,
  type ReviewMode,
  type SubmitReviewRequest,
} from '@kanadrill/shared';

const MAX_COORDINATE = 10_000;

/** Un dessin : 1 à 40 traits, chacun de 1 à 400 points `[x, y]` finis (4000 points au plus en tout). */
export function isDrawing(value: unknown): value is Point2D[][] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DRAWING_STROKES) return false;
  let total = 0;
  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length < 1 || stroke.length > MAX_DRAWING_STROKE_POINTS) return false;
    total += stroke.length;
    if (total > MAX_DRAWING_POINTS) return false;
    for (const point of stroke) {
      if (!Array.isArray(point) || point.length !== 2) return false;
      if (!point.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MAX_COORDINATE)) return false;
    }
  }
  return true;
}

export class SubmitReviewDto implements SubmitReviewRequest {
  @IsUUID()
  itemId!: string;

  @IsIn(REVIEW_MODES)
  mode!: ReviewMode;

  @IsString()
  @MaxLength(32)
  answer!: string;

  /** Plafonnée plutôt que refusée : un onglet laissé ouvert ne doit pas faire échouer la réponse. */
  @Transform(({ value }) => (typeof value === 'number' ? Math.min(value, MAX_REVIEW_DURATION_MS) : value))
  @IsInt()
  @Min(0)
  durationMs!: number;

  @IsOptional()
  @ValidateBy({ name: 'isDrawing', validator: { validate: isDrawing, defaultMessage: () => 'strokes doit être un dessin valide (traits de points [x, y])' } })
  strokes?: Point2D[][];
}
