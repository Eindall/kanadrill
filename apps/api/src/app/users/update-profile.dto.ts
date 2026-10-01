import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import {
  MAX_DAILY_NEW_LIMIT,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  type UpdateProfileRequest,
} from '@kanadrill/shared';

export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces, points, tirets et underscores.',
  })
  username?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_DAILY_NEW_LIMIT)
  dailyNewLimit?: number;
}
