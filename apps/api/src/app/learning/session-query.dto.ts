import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsIn } from 'class-validator';
import {
  REVIEW_MODES,
  SESSION_SIZES,
  SESSION_TYPES,
  type ItemType,
  type ReviewMode,
  type SessionConfig,
  type SessionSize,
} from '@kanadrill/shared';

/** Accepte `a,b` comme `a&a=b` (répétition du paramètre). */
const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    : value;

/** Paramètres de `GET /reviews/session?count=30&types=hiragana,katakana&modes=choice,typing`. */
export class SessionQueryDto implements SessionConfig {
  @Type(() => Number)
  @IsIn(SESSION_SIZES)
  count!: SessionSize;

  @Transform(csv)
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(SESSION_TYPES, { each: true })
  types!: ItemType[];

  @Transform(csv)
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(REVIEW_MODES, { each: true })
  modes!: ReviewMode[];
}
