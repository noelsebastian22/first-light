import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-archive',
  templateUrl: './archive.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Archive {}
