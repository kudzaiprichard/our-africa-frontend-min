// src/app/theme/layout/app-layout.component.ts

import { Component, ViewChild, ElementRef, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

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

  // Navigation Service
  private navigationService = new NavigationService();

  // Page mapping
  private pageMapping: { [key: string]: PageInfo } = {
    'dashboard': { page: 'dashboard', icon: 'fa-home', label: 'Dashboard' },
    'courses': { page: 'courses', icon: 'fa-book', label: 'Courses' },
    'assessments': { page: 'assessments', icon: 'fa-tasks', label: 'Assessments' },
    'certificates': { page: 'certificates', icon: 'fa-certificate', label: 'Certificates' },
    'courses/enrollments': { page: 'courses/enrollments', icon: 'fa-user-graduate', label: 'Enrolled Courses' }
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Initialize current page info based on current URL
    this.handleRouteChange(this.router.url);
    this.updateNavigationState();

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

  // Navigation Methods - for main nav items
  onNavigate(item: NavigationItem): void {
    // Always update navigation and route when a nav item is clicked
    this.navigationService.addPage(item.page);
    this.currentPage = item.page;
    this.updateNavigationState();
    this.updateCurrentPageInfo();

    // Navigate to the route - handle special cases
    let routePath: string[];
    switch(item.page) {
      case 'courses/enrollments':
        routePath = ['/courses', 'enrollments'];
        break;
      default:
        routePath = [`/${item.page}`];
    }

    this.router.navigate(routePath);
    console.log('Navigating to:', item.page, 'History:', this.navigationService.getHistory());
  }

  onBack(): void {
    if (this.navigationService.goBack()) {
      const previousPage = this.navigationService.getCurrentPage();
      this.currentPage = previousPage;
      this.updateNavigationState();
      this.updateCurrentPageInfo();

      // Handle special cases for routing
      let routePath: string[];
      switch(previousPage) {
        case 'courses/enrollments':
          routePath = ['/courses', 'enrollments'];
          break;
        default:
          routePath = [`/${previousPage}`];
      }

      this.router.navigate(routePath);
      console.log('Going back to:', previousPage, 'Index:', this.navigationService.getCurrentIndex());
    }
  }

  onForward(): void {
    if (this.navigationService.goForward()) {
      const nextPage = this.navigationService.getCurrentPage();
      this.currentPage = nextPage;
      this.updateNavigationState();
      this.updateCurrentPageInfo();

      // Handle special cases for routing
      let routePath: string[];
      switch(nextPage) {
        case 'courses/enrollments':
          routePath = ['/courses', 'enrollments'];
          break;
        default:
          routePath = [`/${nextPage}`];
      }

      this.router.navigate(routePath);
      console.log('Going forward to:', nextPage, 'Index:', this.navigationService.getCurrentIndex());
    }
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
    // Extract the main page name from URL (first segment)
    const segments = url.split('/').filter(s => s);

    let mainPage = segments[0] || 'dashboard';

    // Special handling for enrollments - it's under courses but should show as Enrolled Courses
    if (segments[0] === 'courses' && segments[1] === 'enrollments') {
      mainPage = 'courses/enrollments';
    }
    // Assessments routes should show as "Courses" in main nav (since assessments are part of courses)
    else if (segments[0] === 'assessments') {
      mainPage = 'courses';
    }

    // Check if this is one of our main pages
    if (this.pageMapping[mainPage] && mainPage !== this.currentPage) {
      this.navigationService.addPage(mainPage);
      this.currentPage = mainPage;
      this.updateNavigationState();
      this.updateCurrentPageInfo();
      console.log('Route changed to main page:', mainPage, 'History:', this.navigationService.getHistory());
    }
  }
}
