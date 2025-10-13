// src/app/theme/layout/models/navigation.model.ts

export interface NavigationItem {
  page: string;
  label: string;
  icon: string;
}

export interface NavigationHistory {
  history: string[];
  currentIndex: number;
}

export interface PageInfo {
  page: string;
  icon: string;
  label: string;
}

export class NavigationService {
  private history: string[] = ['dashboard'];
  private currentIndex: number = 0;

  addPage(page: string): void {
    // Remove forward history if we're navigating to a new page from middle of history
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Always add the page to history, even if it's the same as current
    // This allows clicking the same nav link multiple times to create history entries
    this.history.push(page);
    this.currentIndex = this.history.length - 1;
  }

  goBack(): boolean {
    if (this.canGoBack()) {
      this.currentIndex--;
      return true;
    }
    return false;
  }

  goForward(): boolean {
    if (this.canGoForward()) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getCurrentPage(): string {
    return this.history[this.currentIndex] || 'dashboard';
  }

  getHistory(): string[] {
    return [...this.history];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
}
