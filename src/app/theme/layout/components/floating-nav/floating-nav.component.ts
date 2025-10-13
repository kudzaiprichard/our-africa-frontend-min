// src/app/theme/layout/components/floating-nav/floating-nav.component.ts

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationItem } from '../../models/navigation.model';

@Component({
  selector: 'app-floating-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-nav.component.html',
  styleUrls: ['./floating-nav.component.scss']
})
export class FloatingNavComponent {
  @Input() isFocusMode: boolean = false;
  @Input() activePage: string = 'dashboard';

  @Output() navigate = new EventEmitter<NavigationItem>();
  @Output() focusModeChange = new EventEmitter<boolean>();

  isNavCollapsed: boolean = false;

  // Navigation items - reversed order (bottom to top)
  navItems: NavigationItem[] = [
    { page: 'courses/enrollments', label: 'Enrolled Courses', icon: 'fa-user-graduate' },
    { page: 'certificates', label: 'Certificates', icon: 'fa-certificate' },
    { page: 'courses', label: 'Courses', icon: 'fa-book' },
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-home' }
  ];

  toggleNav(): void {
    this.isNavCollapsed = !this.isNavCollapsed;
  }

  toggleFocusMode(): void {
    this.focusModeChange.emit(!this.isFocusMode);
  }

  onNavigate(item: NavigationItem): void {
    this.navigate.emit(item);
  }
}
