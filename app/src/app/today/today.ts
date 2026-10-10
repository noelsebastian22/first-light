import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-today',
  templateUrl: './today.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Today {}
