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
    this.history = this.history.slice(0, this.currentIndex + 1);
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
    return this.history[this.currentIndex];
  }

  getHistory(): string[] {
    return [...this.history];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
}
