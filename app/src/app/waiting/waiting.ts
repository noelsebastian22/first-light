import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-waiting',
  templateUrl: './waiting.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Waiting {}
