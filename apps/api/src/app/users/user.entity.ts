import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthIdentity } from './auth-identity.entity';

@Entity('users')
@Check('"daily_goal" BETWEEN 1 AND 500')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Pseudo modifiable. Pas d'unicité : entre potes, on évite la friction à l'inscription. */
  @Column({ type: 'varchar', length: 32 })
  username!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl!: string | null;

  /**
   * Objectif quotidien : nombre de cartes à tenter par jour (= DEFAULT_DAILY_GOAL de libs/shared ;
   * pas d'import de valeur ici : la CLI TypeORM ne résout pas `@kanadrill/shared`).
   */
  @Column({ name: 'daily_goal', type: 'smallint', default: 30 })
  dailyGoal!: number;

  /** Apparaît dans le classement des autres utilisateurs (pseudo, avatar et séries). Désactivable dans le profil. */
  @Column({ name: 'leaderboard_visible', type: 'boolean', default: true })
  leaderboardVisible!: boolean;

  @OneToMany(() => AuthIdentity, (identity) => identity.user)
  identities!: AuthIdentity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
