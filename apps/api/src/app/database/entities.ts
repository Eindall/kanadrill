import { AuthIdentity } from '../users/auth-identity.entity';
import { User } from '../users/user.entity';

/** Liste explicite des entités (pas de glob : le bundle webpack n'a pas de système de fichiers). */
export const ENTITIES = [User, AuthIdentity];
