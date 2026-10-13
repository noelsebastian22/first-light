import { Routes } from '@angular/router';
import { EDITION_SOURCE } from './core/edition-source';
import { memberGuard } from './core/member-guard';
import { NeonEditionSource } from './core/neon-edition-source';
import { Shell } from './shell/shell';
import { todayResolver } from './today/today.resolver';

/** Noel's real editions. The same screens as the demo, on NeonEditionSource. */
export const MEMBER_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    canActivate: [memberGuard],
    providers: [{ provide: EDITION_SOURCE, useExisting: NeonEditionSource }],
    children: [
      { path: 'today', loadComponent: () => import('./today/today').then((m) => m.Today), resolve: { editions: todayResolver }, title: 'Today · First Light' },
      { path: 'news', loadComponent: () => import('./news/news').then((m) => m.News), resolve: { editions: todayResolver }, title: 'News · First Light' },
      { path: 'news/:storyId', loadComponent: () => import('./news/news').then((m) => m.News), resolve: { editions: todayResolver }, title: 'Story · First Light' },
      { path: 'archive', loadComponent: () => import('./archive/archive').then((m) => m.Archive), title: 'Archive · First Light' },
      { path: 'waiting', loadComponent: () => import('./waiting/waiting').then((m) => m.Waiting), title: 'First Light' },
    ],
  },
];
