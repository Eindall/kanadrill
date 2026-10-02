import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { AboutPage } from './features/about/about-page';
import { HomePage } from './features/home/home-page';
import { LoginPage } from './features/login/login-page';
import { ItemPage } from './features/learn/item-page';
import { LearnPage } from './features/learn/learn-page';
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
      { path: 'learn', component: LearnPage, title: 'Apprendre · KanaDrill' },
      { path: 'learn/:id', component: ItemPage, title: 'Fiche · KanaDrill' },
      { path: 'about', component: AboutPage, title: 'À propos · KanaDrill' },
      { path: 'profile', component: ProfilePage, title: 'Mon profil · KanaDrill' },
    ],
  },
  { path: '**', redirectTo: '' },
];
