import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { HomePage } from './features/home/home-page';
import { LoginPage } from './features/login/login-page';
import { ReviewPage } from './features/review/review-page';
import { SetupPage } from './features/review/setup-page';
import { ProfilePage } from './features/profile/profile-page';
import { Shell } from './layout/shell';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard], title: 'Connexion · KanaDrill' },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', component: HomePage, title: 'KanaDrill' },
      { path: 'review/new', component: SetupPage, title: 'Nouvelle session · KanaDrill' },
      { path: 'review', component: ReviewPage, title: 'Révision · KanaDrill' },
      { path: 'profile', component: ProfilePage, title: 'Mon profil · KanaDrill' },
    ],
  },
  { path: '**', redirectTo: '' },
];
