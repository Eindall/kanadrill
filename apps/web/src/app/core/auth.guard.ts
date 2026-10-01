import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Réserve une route aux utilisateurs connectés. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.ensureLoaded()) ? true : router.createUrlTree(['/login']);
};

/** Réserve une route aux visiteurs : un utilisateur déjà connecté est renvoyé à l'accueil. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.ensureLoaded()) ? router.createUrlTree(['/']) : true;
};
