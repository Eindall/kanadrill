import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { CardState, ReviewRating } from '@kanadrill/shared';
import { User } from '../users/user.entity';
import { Item } from './item.entity';

/**
 * Une réponse à une carte. Les champs FSRS (`state` … `learningSteps`) sont le snapshot de la carte
 * **avant** la réponse, comme le `ReviewLog` de ts-fsrs : c'est ce qu'exige l'optimiseur de paramètres.
 */
@Entity('review_logs')
@Index(['userId', 'reviewedAt'])
@Check('"rating" BETWEEN 1 AND 4')
export class ReviewLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => Item, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: Item;

  /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
  @Column({ type: 'smallint' })
  rating!: ReviewRating;

  /** Temps de réponse en millisecondes. */
  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs!: number;

  @Column({ name: 'reviewed_at', type: 'timestamptz', default: () => 'now()' })
  reviewedAt!: Date;

  // --- Snapshot FSRS avant la réponse ---

  @Column({ type: 'smallint' })
  state!: CardState;

  @Column({ type: 'timestamptz' })
  due!: Date;

  @Column({ type: 'double precision' })
  stability!: number;

  @Column({ type: 'double precision' })
  difficulty!: number;

  @Column({ name: 'elapsed_days', type: 'integer' })
  elapsedDays!: number;

  @Column({ name: 'last_elapsed_days', type: 'integer' })
  lastElapsedDays!: number;

  @Column({ name: 'scheduled_days', type: 'integer' })
  scheduledDays!: number;

  @Column({ name: 'learning_steps', type: 'integer' })
  learningSteps!: number;
}
