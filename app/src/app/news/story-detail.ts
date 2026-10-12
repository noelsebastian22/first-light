import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { StoryRow } from './news';

@Component({
  selector: 'app-story-detail',
  templateUrl: './story-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryDetail {
  readonly story = input.required<StoryRow>();
  readonly saved = input(false);
  readonly toggleSave = output<void>();
}
