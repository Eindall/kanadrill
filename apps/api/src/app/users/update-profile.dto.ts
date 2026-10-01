import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  type UpdateProfileRequest,
} from '@kanadrill/shared';

export class UpdateProfileDto implements UpdateProfileRequest {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN, {
    message: 'Le pseudo ne peut contenir que des lettres, chiffres, espaces, points, tirets et underscores.',
  })
  username!: string;
}
