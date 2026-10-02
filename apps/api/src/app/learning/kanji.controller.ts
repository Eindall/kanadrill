import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { KANJI_LEVELS, type KanjiLevel, type KanjiLevelSummaryDto, type KanjiPageDto, type WeeklyKanjiResponse } from '@kanadrill/shared';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddToDictionaryDto } from './dictionary.dto';
import { DictionaryService } from './dictionary.service';
import { KanjiQueryDto } from './kanji-query.dto';
import { KanjiService } from './kanji.service';
import { WeeklyKanjiService } from './weekly-kanji.service';

/** Valeurs de l'énumération pour `ParseEnumPipe` (« N5 »… « other »). */
const LEVELS = Object.fromEntries(KANJI_LEVELS.map((level) => [level, level]));

@Controller()
@UseGuards(JwtAuthGuard)
export class KanjiController {
  constructor(
    private readonly kanji: KanjiService,
    private readonly dictionary: DictionaryService,
    private readonly weekly: WeeklyKanjiService,
  ) {}

  @Get('kanji/levels')
  levels(@CurrentUserId() userId: string): Promise<KanjiLevelSummaryDto[]> {
    return this.kanji.levels(userId);
  }

  /** Le « kanji de la semaine » (le même jusqu'au lundi suivant), ou `null` s'il n'en reste aucun à ajouter. */
  @Get('kanji/weekly')
  async weeklyKanji(@CurrentUserId() userId: string): Promise<WeeklyKanjiResponse> {
    return { kanji: await this.weekly.current(userId) };
  }

  @Get('kanji')
  list(@CurrentUserId() userId: string, @Query() query: KanjiQueryDto): Promise<KanjiPageDto> {
    return this.kanji.list(userId, query);
  }

  /** Ajoute des kanji au dictionnaire ; renvoie le nombre réellement ajouté (les déjà présents ne comptent pas). */
  @Post('dictionary')
  @HttpCode(200)
  async add(@CurrentUserId() userId: string, @Body() body: AddToDictionaryDto): Promise<{ added: number }> {
    return { added: await this.dictionary.add(userId, body.itemIds) };
  }

  @Post('dictionary/levels/:level')
  @HttpCode(200)
  async addLevel(
    @CurrentUserId() userId: string,
    @Param('level', new ParseEnumPipe(LEVELS)) level: KanjiLevel,
  ): Promise<{ added: number }> {
    return { added: await this.dictionary.addLevel(userId, level) };
  }

  @Delete('dictionary/:itemId')
  @HttpCode(204)
  async remove(@CurrentUserId() userId: string, @Param('itemId', ParseUUIDPipe) itemId: string): Promise<void> {
    await this.dictionary.remove(userId, itemId);
  }
}
