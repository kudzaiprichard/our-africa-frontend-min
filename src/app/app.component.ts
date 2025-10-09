import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {PrimaryToastComponent} from './theme/shared';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PrimaryToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'OurAfricaDesktopApp';
}
