import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CardState } from '@kanadrill/shared';
import { User } from '../users/user.entity';
import { Item } from './item.entity';

/**
 * État FSRS d'un item pour un utilisateur. Les colonnes reprennent les champs de `Card` (ts-fsrs) :
 * une ligne se convertit en carte avec `toCard()` et inversement, sans transformation.
 * Valeurs par défaut = `createEmptyCard()`.
 */
@Entity('user_items')
@Index(['userId', 'itemId'], { unique: true })
@Index(['userId', 'due'])
export class UserItem {
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

  @Column({ type: 'timestamptz', default: () => 'now()' })
  due!: Date;

  @Column({ type: 'double precision', default: 0 })
  stability!: number;

  @Column({ type: 'double precision', default: 0 })
  difficulty!: number;

  /** Champ déprécié dans ts-fsrs 5 (supprimé en 6), conservé tant que la lib l'exige. */
  @Column({ name: 'elapsed_days', type: 'integer', default: 0 })
  elapsedDays!: number;

  @Column({ name: 'scheduled_days', type: 'integer', default: 0 })
  scheduledDays!: number;

  @Column({ name: 'learning_steps', type: 'integer', default: 0 })
  learningSteps!: number;

  @Column({ type: 'integer', default: 0 })
  reps!: number;

  /** Nombre de ratés (« lapses » FSRS). */
  @Column({ type: 'integer', default: 0 })
  lapses!: number;

  /** 0 New, 1 Learning, 2 Review, 3 Relearning. */
  @Column({ type: 'smallint', default: 0 })
  state!: CardState;

  @Column({ name: 'last_review', type: 'timestamptz', nullable: true })
  lastReview!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
