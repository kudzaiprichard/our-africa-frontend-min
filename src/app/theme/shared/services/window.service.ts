import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class WindowService {
  private isFullscreen = true;

  async toggleFullscreen(): Promise<boolean> {
    try {
      this.isFullscreen = await invoke<boolean>('toggle_fullscreen');
      return this.isFullscreen;
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error);
      return this.isFullscreen;
    }
  }

  getFullscreenState(): boolean {
    return this.isFullscreen;
  }
}
