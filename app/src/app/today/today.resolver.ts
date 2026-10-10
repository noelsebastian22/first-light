import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { EDITION_SOURCE, type TodayEditions } from '../core/edition-source';

export const todayResolver: ResolveFn<TodayEditions> = () => inject(EDITION_SOURCE).today();
