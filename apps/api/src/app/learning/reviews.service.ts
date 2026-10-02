import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { fsrs, generatorParameters, type Grade } from 'ts-fsrs';
import { DataSource, In, Repository } from 'typeorm';
import {
  CARD_STATE,
  isAnswerCorrect,
  SESSION_TYPES,
  type ItemDto,
  type ItemType,
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
import { buildChoices } from './choices';
import { composeSession, modesFor, pickMode, type CardOrigin } from './compose-session';
import { applyCard, toCard } from './fsrs-card';
import { gradeAnswer } from './grading';
import { Item } from './item.entity';
import { ReviewLog } from './review-log.entity';
import { UserItem } from './user-item.entity';

const strokesOf = (item: Item): StrokeDto[] => (item.metadata as { strokes?: StrokeDto[] } | null)?.strokes ?? [];

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
    const items = await this.items.find({ where: { type: In(config.types) } });
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

    // Leurres du QCM : les autres items du même type.
    const pools = new Map<string, Item[]>();
    for (const item of items) pools.set(item.type, [...(pools.get(item.type) ?? []), item]);

    const cards = composed.map(({ candidate, origin }): SessionCardDto => {
      const strokes = strokesOf(candidate.item);
      const mode = pickMode(modesFor(config.modes, strokes.length > 0));
      return {
        item: this.toItemDto(candidate.item),
        mode,
        ...(mode === 'choice' ? { choices: buildChoices(candidate.item, pools.get(candidate.item.type) ?? []) } : {}),
        ...(mode === 'drawing' ? { strokes } : {}),
        isNew: origin === 'new',
      };
    });

    const count = (origin: CardOrigin) => composed.filter((card) => card.origin === origin).length;
    return { cards, counts: { due: count('due'), new: count('new'), extra: count('extra') } };
  }

  /** Ce que l'écran de réglage et l'accueil affichent : cartes disponibles par type, objectif du jour. */
  async getOverview(userId: string, now = new Date()): Promise<ReviewOverviewDto> {
    const user = await this.users.findOneByOrFail({ id: userId });

    const totals: Array<{ type: ItemType; count: string }> = await this.items
      .createQueryBuilder('item')
      .select('item.type', 'type')
      .addSelect('count(*)', 'count')
      .where('item.type IN (:...types)', { types: SESSION_TYPES })
      .groupBy('item.type')
      .getRawMany();
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

    const correct = isAnswerCorrect(request.mode, request.answer, item.readings);
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

    return { correct, expected: item.readings[0], rating, nextDue: nextDue.toISOString() };
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

  private toItemDto(item: Item): ItemDto {
    return {
      id: item.id,
      type: item.type,
      character: item.character,
      readings: item.readings,
      meanings: item.meanings,
    };
  }
}
