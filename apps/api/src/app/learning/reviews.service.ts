import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { fsrs, generatorParameters, type Grade } from 'ts-fsrs';
import { DataSource, In, Repository } from 'typeorm';
import {
  CARD_STATE,
  expectedAnswer,
  isAnswerCorrect,
  KANA_TYPES,
  modesOfType,
  SESSION_TYPES,
  type AnswerableItem,
  type ItemDto,
  type ItemType,
  type KanjiReadings,
  type ReviewOverviewDto,
  type ReviewResultDto,
  type ReviewSessionDto,
  type SessionCardDto,
  type SessionConfig,
  type StrokeDto,
  type SubmitReviewRequest,
} from '@kanadrill/shared';
import { DEFAULT_TIMEZONE } from '../config/env';
import { User } from '../users/user.entity';
import { buildChoices, buildMeaningChoices, type MeaningDecoy } from './choices';
import { composeSession, modesFor, pickMode, type CardOrigin } from './compose-session';
import { applyCard, toCard } from './fsrs-card';
import { gradeAnswer } from './grading';
import { Item } from './item.entity';
import { ReviewLog } from './review-log.entity';
import { UserItem } from './user-item.entity';

/** Un item tel que la composition d'une session le lit (sans les tracés, lourds : on ne les charge que pour les cartes de tracé). */
interface SessionItem {
  id: string;
  type: ItemType;
  character: string;
  readings: string[];
  meanings: string[];
  sortOrder: number;
  /** Lectures à afficher (kanji). */
  kanji?: KanjiReadings;
  /** Langue des sens (kanji). */
  language: string;
  strokeCount: number;
}

interface SessionItemRow {
  id: string;
  type: ItemType;
  character: string;
  readings: string[];
  meanings: string[];
  sort_order: number;
  on: string[] | null;
  kun: string[] | null;
  language: string | null;
  stroke_count: string | number;
}

/** Les leurres d'un QCM de sens : on n'en tire que quelques centaines au hasard, pas les 10 000 kanji. */
const MEANING_DECOY_SAMPLE = 400;

const answerable = (item: Pick<SessionItem, 'readings' | 'meanings' | 'kanji'>): AnswerableItem => ({
  readings: item.readings,
  meanings: item.meanings,
  kanji: item.kanji,
});

@Injectable()
export class ReviewsService {
  private readonly scheduler = fsrs(generatorParameters({ enable_fuzz: true }));
  private readonly timezone: string;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(UserItem) private readonly userItems: Repository<UserItem>,
  ) {
    this.timezone = config.get<string>('APP_TIMEZONE') || DEFAULT_TIMEZONE;
  }

  /**
   * Compose une session selon le réglage choisi au lancement (taille, types, exercices). N'écrit rien :
   * le `UserItem` d'une carte jamais vue n'est créé qu'à sa première réponse.
   */
  async getSession(userId: string, config: SessionConfig, now = new Date()): Promise<ReviewSessionDto> {
    const items = await this.loadEligibleItems(userId, config);
    const states = await this.userItems.find({ where: { userId, itemId: In(items.map((item) => item.id)) } });
    const stateByItem = new Map(states.map((userItem) => [userItem.itemId, userItem]));

    const candidates = items.map((item) => {
      const userItem = stateByItem.get(item.id);
      return {
        item,
        state: userItem?.state ?? CARD_STATE.New,
        due: userItem?.due ?? null,
        lastReview: userItem?.lastReview ?? null,
        sortOrder: item.sortOrder,
      };
    });

    const composed = composeSession(candidates, config.count, now);
    if (composed.length === 0) throw new BadRequestException('Aucune carte disponible pour cette sélection.');

    // L'exercice de chaque carte, tiré parmi ceux qui lui conviennent.
    const modes = composed.map(({ candidate }) =>
      pickMode(
        modesFor(config.modes, {
          type: candidate.item.type,
          hasStrokes: candidate.item.strokeCount > 0,
          hasReadings: candidate.item.readings.length > 0,
          hasMeanings: candidate.item.meanings.length > 0,
        }),
      ),
    );

    // Leurres du QCM de kana : les autres kana du même type. Leurres du QCM de sens : des kanji tirés au hasard.
    const pools = new Map<string, SessionItem[]>();
    for (const item of items) pools.set(item.type, [...(pools.get(item.type) ?? []), item]);
    const decoys = modes.includes('meaning') ? await this.sampleMeaningDecoys() : [];
    // Modèles de tracé : seulement pour les cartes de tracé.
    const strokes = await this.loadStrokes(composed.filter((_, i) => modes[i] === 'drawing').map(({ candidate }) => candidate.item.id));

    const cards = composed.map(({ candidate, origin }, i): SessionCardDto => {
      const { item } = candidate;
      const mode = modes[i];
      return {
        item: this.toItemDto(item),
        mode,
        ...(mode === 'choice' ? { choices: buildChoices(item, pools.get(item.type) ?? []) } : {}),
        ...(mode === 'meaning' ? { choices: buildMeaningChoices(item, decoys) } : {}),
        ...(mode === 'drawing' ? { strokes: strokes.get(item.id) ?? [] } : {}),
        isNew: origin === 'new',
      };
    });

    const count = (origin: CardOrigin) => composed.filter((card) => card.origin === origin).length;
    return { cards, counts: { due: count('due'), new: count('new'), extra: count('extra') } };
  }

  /**
   * Les cartes éligibles : tous les kana des types cochés, et les kanji **du dictionnaire** de l'utilisateur
   * (un kanji n'entre en révision que s'il l'a ajouté).
   */
  private async loadEligibleItems(userId: string, config: SessionConfig): Promise<SessionItem[]> {
    const kanaTypes = config.types.filter((type) => KANA_TYPES.includes(type));
    const rows: SessionItemRow[] = await this.dataSource.query(
      `SELECT i.id, i.type, i.character, i.readings, i.meanings, i.sort_order,
              i.metadata -> 'on' AS "on", i.metadata -> 'kun' AS kun, i.metadata ->> 'language' AS language,
              coalesce(jsonb_array_length(i.metadata -> 'strokes'), 0) AS stroke_count
       FROM items i
       WHERE i.type = ANY($1)
          OR (i.type = 'kanji' AND $2::boolean
              AND EXISTS (SELECT 1 FROM user_items ui WHERE ui.item_id = i.id AND ui.user_id = $3))`,
      [kanaTypes, config.types.includes('kanji'), userId],
    );
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      character: row.character,
      readings: row.readings,
      meanings: row.meanings,
      sortOrder: row.sort_order,
      kanji: row.type === 'kanji' ? { on: row.on ?? [], kun: row.kun ?? [] } : undefined,
      language: row.language ?? 'en',
      strokeCount: Number(row.stroke_count),
    }));
  }

  private async sampleMeaningDecoys(): Promise<MeaningDecoy[]> {
    const rows: Array<{ meaning: string; language: string | null }> = await this.dataSource.query(
      `SELECT meanings[1] AS meaning, coalesce(metadata ->> 'language', 'en') AS language
       FROM items WHERE type = 'kanji' AND cardinality(meanings) > 0
       ORDER BY random() LIMIT ${MEANING_DECOY_SAMPLE}`,
    );
    return rows.map((row) => ({ meaning: row.meaning, language: row.language ?? 'en' }));
  }

  private async loadStrokes(itemIds: string[]): Promise<Map<string, StrokeDto[]>> {
    if (itemIds.length === 0) return new Map();
    const rows: Array<{ id: string; strokes: StrokeDto[] | null }> = await this.dataSource.query(
      `SELECT id, metadata -> 'strokes' AS strokes FROM items WHERE id = ANY($1)`,
      [itemIds],
    );
    return new Map(rows.map((row) => [row.id, row.strokes ?? []]));
  }

  /** Ce que l'écran de réglage et l'accueil affichent : cartes disponibles par type, objectif du jour. */
  async getOverview(userId: string, now = new Date()): Promise<ReviewOverviewDto> {
    const user = await this.users.findOneByOrFail({ id: userId });

    // Cartes disponibles : tous les kana, mais seulement les kanji du dictionnaire de l'utilisateur.
    const totals: Array<{ type: ItemType; count: string }> = await this.dataSource.query(
      `SELECT type, count(*) AS count FROM items WHERE type = ANY($1) GROUP BY type
       UNION ALL
       SELECT 'kanji' AS type, count(*) AS count
       FROM user_items ui JOIN items i ON i.id = ui.item_id WHERE ui.user_id = $2 AND i.type = 'kanji'`,
      [KANA_TYPES, userId],
    );
    const dues: Array<{ type: ItemType; count: string }> = await this.userItems
      .createQueryBuilder('ui')
      .innerJoin('ui.item', 'item')
      .select('item.type', 'type')
      .addSelect('count(*)', 'count')
      .where('ui.userId = :userId AND ui.state <> :isNew AND ui.due <= :now', {
        userId,
        isNew: CARD_STATE.New,
        now,
      })
      .andWhere('item.type IN (:...types)', { types: SESSION_TYPES })
      .groupBy('item.type')
      .getRawMany();

    const available: ReviewOverviewDto['available'] = {};
    for (const type of SESSION_TYPES) {
      available[type] = {
        total: Number(totals.find((row) => row.type === type)?.count ?? 0),
        due: Number(dues.find((row) => row.type === type)?.count ?? 0),
      };
    }
    return { available, answersToday: await this.countAnswersToday(userId, now), dailyGoal: user.dailyGoal };
  }

  /** Corrige la réponse, la note, fait avancer la carte FSRS et journalise — en une transaction. */
  async submit(userId: string, request: SubmitReviewRequest, now = new Date()): Promise<ReviewResultDto> {
    const item = await this.items.findOneBy({ id: request.itemId });
    if (!item) throw new NotFoundException('Élément introuvable');
    if (!modesOfType(item.type).includes(request.mode)) {
      throw new BadRequestException('Cet exercice ne convient pas à cet élément.');
    }
    if (item.type === 'kanji' && !(await this.userItems.existsBy({ userId, itemId: item.id }))) {
      throw new BadRequestException("Ce kanji n'est pas dans ton dictionnaire.");
    }

    const meta = (item.metadata ?? {}) as { on?: string[]; kun?: string[] };
    const subject: AnswerableItem = {
      readings: item.readings,
      meanings: item.meanings,
      kanji: item.type === 'kanji' ? { on: meta.on ?? [], kun: meta.kun ?? [] } : undefined,
    };
    const correct = isAnswerCorrect(request.mode, request.answer, subject);
    const rating = gradeAnswer({ correct, mode: request.mode, durationMs: request.durationMs, answer: request.answer });

    const nextDue = await this.dataSource.transaction(async (manager) => {
      // Première réponse : la carte est créée avec les valeurs par défaut (= carte vierge).
      await manager
        .createQueryBuilder()
        .insert()
        .into(UserItem)
        .values({ userId, itemId: item.id })
        .orIgnore()
        .execute();
      const userItem = await manager.findOneOrFail(UserItem, {
        where: { userId, itemId: item.id },
        lock: { mode: 'pessimistic_write' },
      });

      const { card, log } = this.scheduler.next(toCard(userItem), now, rating as Grade);
      await manager.insert(ReviewLog, {
        userId,
        itemId: item.id,
        rating,
        durationMs: request.durationMs,
        reviewedAt: now,
        // Snapshot de la carte avant la réponse.
        state: log.state,
        due: log.due,
        stability: log.stability,
        difficulty: log.difficulty,
        elapsedDays: log.elapsed_days,
        lastElapsedDays: log.last_elapsed_days,
        scheduledDays: log.scheduled_days,
        learningSteps: log.learning_steps,
      });
      applyCard(userItem, card);
      await manager.save(userItem);
      return card.due;
    });

    return { correct, expected: expectedAnswer(request.mode, subject), rating, nextDue: nextDue.toISOString() };
  }

  /** Réponses données depuis minuit (dans `APP_TIMEZONE`), réussies ou non : ce que mesure l'objectif quotidien. */
  private async countAnswersToday(userId: string, now: Date): Promise<number> {
    const rows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT count(*) AS count FROM review_logs
       WHERE user_id = $1
         AND reviewed_at >= (date_trunc('day', $2::timestamptz AT TIME ZONE $3) AT TIME ZONE $3)`,
      [userId, now, this.timezone],
    );
    return Number(rows[0].count);
  }

  private toItemDto(item: SessionItem): ItemDto {
    return {
      id: item.id,
      type: item.type,
      character: item.character,
      readings: item.readings,
      meanings: item.meanings,
      ...(item.kanji ? { kanji: item.kanji } : {}),
    };
  }
}
