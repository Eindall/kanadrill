import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { appRoutes } from './app.routes';
import { ThemeService } from './core/theme.service';
import { unauthorizedInterceptor } from './core/unauthorized.interceptor';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([unauthorizedInterceptor])),
    // Instancié dès le démarrage : le thème s'applique aussi à la page de connexion, hors Shell.
    provideAppInitializer(() => void inject(ThemeService)),
    { provide: LOCALE_ID, useValue: 'fr' },
    // Service worker : coque de l'application seulement (voir ngsw-config.json), jamais l'API.
    // Actif uniquement dans le build de production (le build de développement n'en génère pas).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
