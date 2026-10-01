import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ItemType } from '@kanadrill/shared';

/** Un élément à apprendre (kana, kanji…). Commun à tous les utilisateurs. */
@Entity('items')
@Index(['type', 'character'], { unique: true })
@Check('"type" IN (\'hiragana\', \'katakana\', \'kanji\')')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: ItemType;

  /** Le caractère (ou groupe de caractères pour un yōon, ex. « きゃ »). */
  @Column({ type: 'varchar', length: 16 })
  character!: string;

  /** Romaji acceptés ; le premier est la lecture de référence. */
  @Column({ type: 'text', array: true })
  readings!: string[];

  /** Sens (vide pour les kana). */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  meanings!: string[];

  /** Données propres au type (ex. traits d'un kanji). */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
