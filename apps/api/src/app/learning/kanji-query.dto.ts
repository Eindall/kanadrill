import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { KANJI_LEVELS, KANJI_MAX_PAGE_SIZE, KANJI_PAGE_SIZE, type KanjiLevel } from '@kanadrill/shared';

/** Paramètres de `GET /kanji?level=N5&q=日&offset=0&limit=100`. */
export class KanjiQueryDto {
  @IsOptional()
  @IsIn(KANJI_LEVELS)
  level?: KanjiLevel;

  /** Un ou plusieurs kanji (« 日本 »), ou un mot : sens ou lecture en romaji. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(KANJI_MAX_PAGE_SIZE)
  limit: number = KANJI_PAGE_SIZE;
}
