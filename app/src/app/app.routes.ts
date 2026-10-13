import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./landing/landing').then((m) => m.Landing), title: 'First Light' },
  { path: 'demo', loadChildren: () => import('./demo.routes').then((m) => m.DEMO_ROUTES) },
  { path: 'signin', loadComponent: () => import('./signin/signin').then((m) => m.Signin), title: 'Sign in · First Light' },
  { path: '', loadChildren: () => import('./member.routes').then((m) => m.MEMBER_ROUTES) },
  { path: '**', redirectTo: '' },
];
