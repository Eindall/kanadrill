import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
  MAX_REVIEW_DURATION_MS,
  REVIEW_MODES,
  type ReviewMode,
  type SubmitReviewRequest,
} from '@kanadrill/shared';

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
}
