import { inject } from '@angular/core';
import { RedirectCommand, Router, type ResolveFn } from '@angular/router';
import { EDITION_SOURCE, type TodayEditions } from '../core/edition-source';

export const todayResolver: ResolveFn<TodayEditions> = async () => {
  const source = inject(EDITION_SOURCE);
  const router = inject(Router);
  const editions = await source.today();
  return editions ?? new RedirectCommand(router.parseUrl('/waiting'));
};
