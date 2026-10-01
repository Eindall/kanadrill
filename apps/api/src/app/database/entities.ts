import { AuthSession } from '../auth/auth-session.entity';
import { Item } from '../learning/item.entity';
import { ReviewLog } from '../learning/review-log.entity';
import { UserItem } from '../learning/user-item.entity';
import { AuthIdentity } from '../users/auth-identity.entity';
import { User } from '../users/user.entity';

/** Liste explicite des entités (pas de glob : le bundle webpack n'a pas de système de fichiers). */
export const ENTITIES = [User, AuthIdentity, AuthSession, Item, UserItem, ReviewLog];
