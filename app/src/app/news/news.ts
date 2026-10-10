import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-news',
  templateUrl: './news.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class News {}
