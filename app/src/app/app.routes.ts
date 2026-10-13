import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./landing/landing').then((m) => m.Landing), title: 'First Light' },
  { path: 'demo', loadChildren: () => import('./demo.routes').then((m) => m.DEMO_ROUTES) },
  { path: 'signin', loadComponent: () => import('./signin/signin').then((m) => m.Signin), title: 'Sign in · First Light' },
  { path: 'spike', loadComponent: () => import('./spike/spike').then((m) => m.Spike), title: 'Spike · First Light' },
  { path: '**', redirectTo: '' },
];
