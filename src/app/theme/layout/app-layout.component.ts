// src/app/theme/layout/app-layout.component.ts

import { Component, ViewChild, ElementRef, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { NavHistoryComponent } from './components/nav-history/nav-history.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { FloatingNavComponent } from './components/floating-nav/floating-nav.component';
import { ScrollIndicatorComponent } from './components/scroll-indicator/scroll-indicator.component';
import { NavigationItem, PageInfo, NavigationService } from './models/navigation.model';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavHistoryComponent,
    UserProfileComponent,
    FloatingNavComponent,
    ScrollIndicatorComponent
  ],
  templateUrl: './app-layout.component.html',
  styleUrls: ['./app-layout.component.scss']
})
export class AppLayoutComponent implements OnInit {
  @ViewChild('contentContainer') contentContainer!: ElementRef<HTMLDivElement>;

  // Focus Mode State
  isFocusMode: boolean = false;

  // Navigation State
  currentPage: string = 'dashboard';
  canGoBack: boolean = false;
  canGoForward: boolean = false;
  currentPageInfo: PageInfo | null = null;

  // User Info
  userEmail: string = 'alex.smith@email.com';
  userRole: string = 'Premium Member';
  userInitials: string = 'AS';

  // Navigation Service
  private navigationService = new NavigationService();

  // Page mapping
  private pageMapping: { [key: string]: PageInfo } = {
    'dashboard': { page: 'dashboard', icon: 'fa-home', label: 'Dashboard' },
    'courses': { page: 'courses', icon: 'fa-book', label: 'Courses' },
    'certificates': { page: 'certificates', icon: 'fa-certificate', label: 'Certificates' },
    'settings': { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Initialize current page info
    this.updateCurrentPageInfo();

    // Listen to route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || event.url;
        this.handleRouteChange(url);
      });
  }

  // ESC key to exit focus mode
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isFocusMode) {
      this.toggleFocusMode(false);
    }
  }

  // Toggle Focus Mode
  toggleFocusMode(state: boolean): void {
    this.isFocusMode = state;
    console.log(this.isFocusMode ? 'Entered Focus Mode' : 'Exited Focus Mode');
  }

  // Navigation Methods
  onNavigate(item: NavigationItem): void {
    if (item.page !== this.currentPage) {
      this.navigationService.addPage(item.page);
      this.currentPage = item.page;
      this.updateNavigationState();
      this.updateCurrentPageInfo();

      // Navigate to the route
      this.router.navigate([`/${item.page}`]);
      console.log('Navigating to:', item.page);
    }
  }

  onBack(): void {
    if (this.navigationService.goBack()) {
      this.currentPage = this.navigationService.getCurrentPage();
      this.updateNavigationState();
      this.updateCurrentPageInfo();
      this.router.navigate([`/${this.currentPage}`]);
      console.log('Going back to:', this.currentPage);
    }
  }

  onForward(): void {
    if (this.navigationService.goForward()) {
      this.currentPage = this.navigationService.getCurrentPage();
      this.updateNavigationState();
      this.updateCurrentPageInfo();
      this.router.navigate([`/${this.currentPage}`]);
      console.log('Going forward to:', this.currentPage);
    }
  }

  // User Profile Actions
  onProfile(): void {
    console.log('Navigate to profile');
    this.router.navigate(['/profile']);
  }

  onSettings(): void {
    console.log('Navigate to settings');
    this.router.navigate(['/settings']);
  }

  onLogout(): void {
    console.log('Logging out...');
    // Add your logout logic here
    // this.authService.logout();
    this.router.navigate(['/authentication/signin']);
  }

  // Helper Methods
  private updateNavigationState(): void {
    this.canGoBack = this.navigationService.canGoBack();
    this.canGoForward = this.navigationService.canGoForward();
  }

  private updateCurrentPageInfo(): void {
    this.currentPageInfo = this.pageMapping[this.currentPage] || null;
  }

  private handleRouteChange(url: string): void {
    // Extract page name from URL
    const segments = url.split('/').filter(s => s);
    const pageName = segments[segments.length - 1] || 'dashboard';

    if (this.pageMapping[pageName] && pageName !== this.currentPage) {
      this.navigationService.addPage(pageName);
      this.currentPage = pageName;
      this.updateNavigationState();
      this.updateCurrentPageInfo();
    }
  }
}
