import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Une session ouverte (un appareil connecté). Son `id` est le `jti` du JWT du cookie : le jeton ne vaut que
 * tant que cette ligne existe, n'est pas révoquée et n'a pas expiré. Les `jti` seuls ne permettent pas de
 * fabriquer un cookie (il faut aussi la signature), donc inutile de stocker une empreinte du jeton.
 */
@Entity('auth_sessions')
@Index(['userId'])
@Index(['expiresAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Dernière requête authentifiée (mise à jour au plus toutes les 10 minutes). */
  @Column({ name: 'last_used_at', type: 'timestamptz', default: () => 'now()' })
  lastUsedAt!: Date;

  /** Expiration glissante : repoussée à chaque usage, sans jamais dépasser `created_at` + plafond absolu. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  /** User-Agent à l'ouverture (tronqué), pour reconnaître l'appareil dans la liste. */
  @Column({ name: 'user_agent', type: 'varchar', length: 256, nullable: true })
  userAgent!: string | null;
}
