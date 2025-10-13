import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PrimaryToastComponent } from './theme/shared';
import {WindowService} from './theme/shared/services/window.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PrimaryToastComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'OurAfricaDesktopApp';
  isFullscreen = true;

  constructor(private windowService: WindowService) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'F11') {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  async toggleFullscreen() {
    this.isFullscreen = await this.windowService.toggleFullscreen();
  }
}
