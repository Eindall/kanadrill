import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** La vérification initiale du profil gère elle-même son 401 (= simplement « pas connecté »). */
export function isSessionCheck(req: Pick<HttpRequest<unknown>, 'method' | 'url'>): boolean {
  return req.method === 'GET' && req.url === '/api/users/me';
}

/**
 * Un 401 sur un appel d'API signifie que la session n'est plus valable (expirée, ou révoquée depuis un autre
 * appareil) : on oublie l'utilisateur et on renvoie vers la connexion, plutôt que d'afficher des écrans d'erreur.
 */
export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isSessionCheck(req)) {
        auth.clearUser();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
