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
import type { AuthProvider } from '@kanadrill/shared';
import { User } from './user.entity';

/**
 * Lien entre un utilisateur et un compte chez un fournisseur OAuth.
 * La clé d'identité est (provider, providerId) : l'ID Discord est immuable, contrairement au pseudo.
 */
@Entity('auth_identities')
@Index(['provider', 'providerId'], { unique: true })
@Index(['emailHash'])
export class AuthIdentity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  provider!: AuthProvider;

  @Column({ name: 'provider_id', type: 'varchar', length: 64 })
  providerId!: string;

  /** Pseudo chez le fournisseur à la dernière connexion (affichage uniquement). */
  @Column({ name: 'display_name', type: 'varchar', length: 128, nullable: true })
  displayName!: string | null;

  /**
   * HMAC-SHA256 (hex) de l'e-mail **vérifié** par le fournisseur, pour détecter qu'une même personne se connecte
   * avec un autre fournisseur. `null` si l'e-mail est absent ou non vérifié. Jamais exposé par l'API.
   * Volontairement non unique : il ne sert qu'à signaler un doublon, jamais à lier des comptes.
   */
  @Column({ name: 'email_hash', type: 'varchar', length: 64, nullable: true })
  emailHash!: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.identities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
