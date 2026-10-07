import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import type { AuthProvider, UpdateProfileRequest, UserDto } from '@kanadrill/shared';
import { AuthIdentity } from './auth-identity.entity';
import { User } from './user.entity';

export interface ProviderProfile {
  provider: AuthProvider;
  providerId: string;
  displayName: string;
  avatarUrl: string | null;
  /** Empreinte de l'e-mail vérifié (voir `hashEmail`) ; l'e-mail en clair n'arrive jamais jusqu'ici. */
  emailHash: string | null;
}

export type SignInResult =
  | { kind: 'ok'; user: User }
  /** Une identité d'un autre fournisseur a la même adresse vérifiée : pas de compte créé, on renvoie vers celui-là. */
  | { kind: 'account_exists'; provider: AuthProvider };

export type LinkResult = 'linked' | 'conflict' | 'provider_taken';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
  ) {}

  /**
   * Connexion OAuth : retrouve l'utilisateur lié à ce compte, ou le crée.
   * Jamais de liaison automatique : si l'identité est inconnue mais que son e-mail vérifié (empreinte) correspond
   * à une identité d'un autre fournisseur, on ne crée rien (`account_exists`) ; l'utilisateur se connecte avec
   * l'autre fournisseur puis lie celui-ci depuis son profil.
   * À la création, le pseudo et l'avatar sont repris du fournisseur ; ensuite le pseudo
   * appartient à l'utilisateur (on ne l'écrase pas), l'avatar reste celui du premier fournisseur.
   */
  async signIn(profile: ProviderProfile): Promise<SignInResult> {
    const existing = await this.identities.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
      relations: { user: true },
    });

    if (existing) {
      existing.displayName = profile.displayName;
      existing.emailHash = profile.emailHash; // recalculé à chaque connexion (null si plus vérifié)
      await this.identities.save(existing);
      // L'avatar vient du premier fournisseur du compte : se connecter par un fournisseur lié ensuite ne le change
      // pas (il suit en revanche les changements chez le premier fournisseur, ou se remplit s'il était vide).
      if (existing.user.avatarUrl !== profile.avatarUrl && (await this.isPrimaryIdentity(existing, existing.user))) {
        existing.user.avatarUrl = profile.avatarUrl;
        await this.users.save(existing.user);
      }
      return { kind: 'ok', user: existing.user };
    }

    if (profile.emailHash) {
      const sameEmail = await this.identities.findOne({
        where: { emailHash: profile.emailHash, provider: Not(profile.provider) },
      });
      if (sameEmail) return { kind: 'account_exists', provider: sameEmail.provider };
    }

    const user = await this.users.save(
      this.users.create({
        username: this.sanitizeUsername(profile.displayName),
        avatarUrl: profile.avatarUrl,
      }),
    );
    await this.identities.save(this.createIdentity(user.id, profile));
    return { kind: 'ok', user };
  }

  /**
   * Liaison d'un fournisseur à un compte connecté (aucun rapprochement par e-mail : l'utilisateur a prouvé
   * qu'il possède les deux comptes). Refusée si l'identité appartient à un autre compte, ou si ce compte
   * a déjà une identité chez ce fournisseur.
   */
  async linkIdentity(userId: string, profile: ProviderProfile): Promise<LinkResult> {
    const existing = await this.identities.findOneBy({ provider: profile.provider, providerId: profile.providerId });
    if (existing) {
      if (existing.userId !== userId) return 'conflict';
      existing.displayName = profile.displayName;
      existing.emailHash = profile.emailHash;
      await this.identities.save(existing);
      return 'linked';
    }
    if (await this.identities.existsBy({ userId, provider: profile.provider })) return 'provider_taken';
    await this.identities.save(this.createIdentity(userId, profile));
    return 'linked';
  }

  /** Dissocie un fournisseur ; refusé pour la dernière identité (le compte deviendrait inaccessible). */
  async unlinkIdentity(userId: string, provider: AuthProvider): Promise<void> {
    const mine = await this.identities.findBy({ userId });
    if (!mine.some((identity) => identity.provider === provider)) throw new NotFoundException('Connexion introuvable');
    if (mine.length <= 1) throw new ConflictException('Impossible de dissocier la dernière connexion du compte');
    // Garde-fou contre deux dissociations simultanées : la condition est évaluée dans le DELETE lui-même.
    const [rows] = (await this.identities.manager.query(
      `DELETE FROM auth_identities
       WHERE user_id = $1 AND provider = $2
         AND (SELECT count(*) FROM auth_identities WHERE user_id = $1) > 1
       RETURNING id`,
      [userId, provider],
    )) as [unknown[], number];
    if (rows.length === 0) throw new ConflictException('Impossible de dissocier la dernière connexion du compte');
  }

  /** Vrai si l'identité est la plus ancienne du compte, ou si le compte n'a pas encore d'avatar. */
  private async isPrimaryIdentity(identity: AuthIdentity, user: User): Promise<boolean> {
    if (!user.avatarUrl) return true;
    const oldest = await this.identities.findOne({ where: { userId: user.id }, order: { createdAt: 'ASC', id: 'ASC' } });
    return oldest?.id === identity.id;
  }

  private createIdentity(userId: string, profile: ProviderProfile): AuthIdentity {
    return this.identities.create({
      provider: profile.provider,
      providerId: profile.providerId,
      displayName: profile.displayName,
      emailHash: profile.emailHash,
      userId,
    });
  }

  async findOneOrFail(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id }, relations: { identities: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async updateProfile(id: string, patch: UpdateProfileRequest): Promise<User> {
    const user = await this.findOneOrFail(id);
    if (patch.username !== undefined) user.username = patch.username;
    if (patch.dailyGoal !== undefined) user.dailyGoal = patch.dailyGoal;
    if (patch.leaderboardVisible !== undefined) user.leaderboardVisible = patch.leaderboardVisible;
    await this.users.save(user);
    return user;
  }

  /** Supprime l'utilisateur ; ses identités (et plus tard ses révisions) partent en cascade. */
  async remove(id: string): Promise<void> {
    await this.users.delete({ id });
  }

  toDto(user: User): UserDto {
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      dailyGoal: user.dailyGoal,
      leaderboardVisible: user.leaderboardVisible,
      createdAt: user.createdAt.toISOString(),
      identities: (user.identities ?? []).map((identity) => ({
        provider: identity.provider,
        displayName: identity.displayName,
        linkedAt: identity.createdAt.toISOString(),
      })),
    };
  }

  /** Les pseudos Discord peuvent être plus permissifs que nos règles : on nettoie. */
  private sanitizeUsername(raw: string): string {
    const cleaned = raw.replace(/[^\p{L}\p{N}_\-. ]/gu, '').trim().slice(0, 32);
    return cleaned.length >= 2 ? cleaned : 'Apprenant';
  }
}
