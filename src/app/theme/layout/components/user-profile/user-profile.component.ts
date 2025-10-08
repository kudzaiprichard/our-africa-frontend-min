// src/app/theme/layout/components/user-profile/user-profile.component.ts

import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent {
  @Input() userEmail: string = 'alex.smith@email.com';
  @Input() userRole: string = 'Premium Member';
  @Input() userInitials: string = 'AS';

  @Output() profile = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  isDropdownOpen: boolean = false;

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: Event): void {
    this.isDropdownOpen = false;
  }

  onProfile(): void {
    this.profile.emit();
    this.isDropdownOpen = false;
  }

  onSettings(): void {
    this.settings.emit();
    this.isDropdownOpen = false;
  }

  onLogout(): void {
    this.logout.emit();
    this.isDropdownOpen = false;
  }
}
