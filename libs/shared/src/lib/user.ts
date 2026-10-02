import type { AuthProvider } from './auth';

export interface AuthIdentityDto {
  provider: AuthProvider;
  /** Pseudo affiché chez le fournisseur lors de la dernière connexion. */
  displayName: string | null;
  linkedAt: string;
}

export interface UserDto {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  identities: AuthIdentityDto[];
  /** Objectif quotidien : nombre de cartes à tenter par jour. */
  dailyGoal: number;
  /** Visible dans le classement des autres utilisateurs. */
  leaderboardVisible: boolean;
}

export interface UpdateProfileRequest {
  username?: string;
  dailyGoal?: number;
  leaderboardVisible?: boolean;
}
