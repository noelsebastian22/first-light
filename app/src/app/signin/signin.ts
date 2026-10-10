import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-signin',
  imports: [RouterLink],
  templateUrl: './signin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Signin {}
