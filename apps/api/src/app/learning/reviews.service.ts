import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { fsrs, generatorParameters, type Grade } from 'ts-fsrs';
import { DataSource, In, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  CARD_STATE,
  isRomajiCorrect,
  type ItemDto,
  type ReviewResultDto,
  type ReviewSessionDto,
  type SessionCardDto,
  type SubmitReviewRequest,
} from '@kanadrill/shared';
import { DEFAULT_TIMEZONE } from '../config/env';
import { User } from '../users/user.entity';
import { buildChoices } from './choices';
import { applyCard, toCard } from './fsrs-card';
import { gradeAnswer } from './grading';
import { Item } from './item.entity';
import { ReviewLog } from './review-log.entity';
import { UserItem } from './user-item.entity';

/** Plafond de cartes dues par session (garde-fou si l'utilisateur revient après une longue pause). */
export const MAX_DUE_PER_SESSION = 100;

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

  /** Cartes dues, puis nouvelles cartes dans la limite quotidienne restante. N'écrit rien. */
  async getSession(userId: string, now = new Date()): Promise<ReviewSessionDto> {
    const user = await this.users.findOneByOrFail({ id: userId });

    const due = await this.userItems.find({
      where: { userId, state: Not(CARD_STATE.New), due: LessThanOrEqual(now) },
      relations: { item: true },
      order: { due: 'ASC' },
      take: MAX_DUE_PER_SESSION,
    });

    const newSeenToday = await this.countNewSeenToday(userId, now);
    const remaining = Math.max(0, user.dailyNewLimit - newSeenToday);
    const fresh =
      remaining === 0
        ? []
        : await this.items
            .createQueryBuilder('item')
            .where(
              'NOT EXISTS (SELECT 1 FROM user_items ui WHERE ui.item_id = item.id AND ui.user_id = :userId)',
              { userId },
            )
            .orderBy('item.sortOrder', 'ASC')
            .addOrderBy('item.character', 'ASC')
            .take(remaining)
            .getMany();

    const entries = [
      ...due.map((userItem) => ({ item: userItem.item, state: userItem.state, isNew: false })),
      ...fresh.map((item) => ({ item, state: CARD_STATE.New as number, isNew: true })),
    ];

    // Leurres du QCM : les autres items du même type (une seule requête par type présent).
    const types = [...new Set(entries.map((entry) => entry.item.type))];
    const pools = new Map<string, Item[]>();
    if (types.length > 0) {
      for (const item of await this.items.find({ where: { type: In(types) } })) {
        pools.set(item.type, [...(pools.get(item.type) ?? []), item]);
      }
    }

    const cards = entries.map(({ item, state, isNew }): SessionCardDto => {
      const typing = state === CARD_STATE.Review;
      return {
        item: this.toItemDto(item),
        mode: typing ? 'typing' : 'choice',
        ...(typing ? {} : { choices: buildChoices(item, pools.get(item.type) ?? []) }),
        isNew,
      };
    });

    return {
      cards,
      counts: { due: due.length, new: fresh.length },
      dailyNewLimit: user.dailyNewLimit,
    };
  }

  /** Corrige la réponse, la note, fait avancer la carte FSRS et journalise — en une transaction. */
  async submit(userId: string, request: SubmitReviewRequest, now = new Date()): Promise<ReviewResultDto> {
    const item = await this.items.findOneBy({ id: request.itemId });
    if (!item) throw new NotFoundException('Élément introuvable');

    const correct = isRomajiCorrect(request.answer, item.readings);
    const rating = gradeAnswer({ correct, mode: request.mode, durationMs: request.durationMs });

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

  /** Nouvelles cartes déjà introduites aujourd'hui : réponses dont la carte était « New », depuis minuit. */
  private async countNewSeenToday(userId: string, now: Date): Promise<number> {
    const rows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT count(*) AS count FROM review_logs
       WHERE user_id = $1 AND state = $2
         AND reviewed_at >= (date_trunc('day', $3::timestamptz AT TIME ZONE $4) AT TIME ZONE $4)`,
      [userId, CARD_STATE.New, now, this.timezone],
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
