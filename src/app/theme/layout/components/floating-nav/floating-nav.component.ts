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

  // Tooltip state
  tooltipVisible: boolean = false;
  tooltipText: string = '';
  tooltipLeft: number = 0;
  tooltipTop: number = 0;

  navItems: NavigationItem[] = [
    { page: 'dashboard', label: 'Dashboard', icon: 'fa-home' },
    { page: 'courses', label: 'Courses', icon: 'fa-book' },
    { page: 'certificates', label: 'Certificates', icon: 'fa-certificate' },
    { page: 'courses/enrollments', label: 'Enrolled Courses', icon: 'fa-user-graduate' }
  ];

  toggleFocusMode(): void {
    this.hideTooltip(); // 👈 HIDE TOOLTIP WHEN TOGGLING FOCUS MODE
    this.focusModeChange.emit(!this.isFocusMode);
  }

  onNavigate(item: NavigationItem): void {
    this.hideTooltip(); // 👈 HIDE TOOLTIP WHEN NAVIGATING
    this.navigate.emit(item);
  }

  showTooltip(event: MouseEvent, text: string): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.tooltipText = text;
    this.tooltipLeft = rect.right + 12; // 12px gap from nav item
    this.tooltipTop = rect.top + (rect.height / 2); // Center vertically
    this.tooltipVisible = true;
  }

  hideTooltip(): void {
    this.tooltipVisible = false;
  }
}
