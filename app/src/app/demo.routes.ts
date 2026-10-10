import { Routes } from '@angular/router';
import { EDITION_SOURCE } from './core/edition-source';
import { DemoEditionSource } from './core/demo-edition-source';
import { Shell } from './shell/shell';

/** The public demo: the real screens on the hand-written sample edition. Lazy-loaded. */
export const DEMO_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    providers: [{ provide: EDITION_SOURCE, useExisting: DemoEditionSource }],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', loadComponent: () => import('./today/today').then((m) => m.Today), title: 'Today · First Light' },
      { path: 'news', loadComponent: () => import('./news/news').then((m) => m.News), title: 'News · First Light' },
      { path: 'news/:storyId', loadComponent: () => import('./news/news').then((m) => m.News), title: 'Story · First Light' },
      { path: 'archive', loadComponent: () => import('./archive/archive').then((m) => m.Archive), title: 'Archive · First Light' },
    ],
  },
];
