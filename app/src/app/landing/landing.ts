import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Prefs } from '../core/prefs';
import { MorningMachine } from './morning-machine';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, MorningMachine],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly prefs = inject(Prefs);
  protected readonly steps = [
    { name: '01 · Gather', progress: 's1', text: 'At 5:32am a scheduled job pulls about twenty feeds: RBA, ABC, SBS, The Conversation, JavaScript Weekly, smol.ai and the weather for the Mountains. Everything arrives in a jumble.' },
    { name: '02 · Think', progress: 's2', text: 'Claude removes duplicates, ranks stories against what I care about and writes each one in its own words. Every line points to a real article; links are built in code, never by the model.' },
    { name: '03 · Deliver', progress: 's3', text: 'Stories leave one at a time, sorted by section, into the morning edition. The app caches it for the train, and the 4pm run adds what changed.' },
  ];
  protected readonly safe = [
    { fill: 'var(--fl-sec-web-dev)', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4', title: 'No button runs the AI', body: 'Claude only runs inside a scheduled job with no outside connections. No key reaches the browser, so there is nothing here to abuse.' },
    { fill: 'var(--fl-sec-au-economy)', icon: 'M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3', title: 'One reader, sealed at the database', body: 'Google sign-in for one account, and row-level security means any other session reads nothing at all.' },
    { fill: 'var(--fl-sec-world)', icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', title: 'Every story links home', body: 'Summaries are short, in Claude’s own words, and always send you to the original publisher.' },
  ];
  protected readonly stack = ['Angular 22', 'Signals + Signal Forms', 'resource / httpResource', 'Route resolvers', 'Service worker PWA', 'Neon Postgres + RLS', 'Google sign-in', 'Claude Code routines', 'GitHub Actions'];
}
