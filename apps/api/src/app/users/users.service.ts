import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthProvider, UserDto } from '@kanadrill/shared';
import { AuthIdentity } from './auth-identity.entity';
import { User } from './user.entity';

export interface ProviderProfile {
  provider: AuthProvider;
  providerId: string;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
  ) {}

  /**
   * Connexion OAuth : retrouve l'utilisateur lié à ce compte, ou le crée.
   * À la création, le pseudo et l'avatar sont repris du fournisseur ; ensuite le pseudo
   * appartient à l'utilisateur (on ne l'écrase pas), l'avatar suit celui de Discord.
   */
  async upsertFromProvider(profile: ProviderProfile): Promise<User> {
    const existing = await this.identities.findOne({
      where: { provider: profile.provider, providerId: profile.providerId },
      relations: { user: true },
    });

    if (existing) {
      existing.displayName = profile.displayName;
      await this.identities.save(existing);
      if (existing.user.avatarUrl !== profile.avatarUrl) {
        existing.user.avatarUrl = profile.avatarUrl;
        await this.users.save(existing.user);
      }
      return existing.user;
    }

    const user = await this.users.save(
      this.users.create({
        username: this.sanitizeUsername(profile.displayName),
        avatarUrl: profile.avatarUrl,
      }),
    );
    await this.identities.save(
      this.identities.create({
        provider: profile.provider,
        providerId: profile.providerId,
        displayName: profile.displayName,
        userId: user.id,
      }),
    );
    return user;
  }

  async findOneOrFail(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id }, relations: { identities: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async updateUsername(id: string, username: string): Promise<User> {
    const user = await this.findOneOrFail(id);
    user.username = username;
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
