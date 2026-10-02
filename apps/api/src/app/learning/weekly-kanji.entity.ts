import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Item } from './item.entity';

/**
 * Le « kanji de la semaine » d'un utilisateur : tiré à la première visite de la semaine puis gardé jusqu'au lundi
 * suivant. Sans cette ligne, ajouter le kanji au dictionnaire changerait la suggestion (il ne serait plus « restant »).
 */
@Entity('weekly_kanji')
@Index(['userId', 'weekStart'], { unique: true })
export class WeeklyKanji {
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

  /** Le lundi (dans `APP_TIMEZONE`) de la semaine concernée, `AAAA-MM-JJ`. */
  @Column({ name: 'week_start', type: 'date' })
  weekStart!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
