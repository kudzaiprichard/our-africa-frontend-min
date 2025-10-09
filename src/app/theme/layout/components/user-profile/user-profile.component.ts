// src/app/theme/layout/components/user-profile/user-profile.component.ts

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../libs/identity_access/services/auth.service';
import { UserService } from '../../../../libs/identity_access/services/user.service';
import { ToastsService, ToastType } from '../../../shared';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userEmail: string = '';
  userRole: string = '';
  userInitials: string = '';
  isDropdownOpen: boolean = false;
  isLoggingOut: boolean = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private toastsService: ToastsService
  ) {}

  ngOnInit(): void {
    // Subscribe to user data changes
    this.userService.getCurrentUser$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.userEmail = user.email;
          this.userRole = this.getRoleDisplay(user.role);
          this.userInitials = this.getInitials(user.first_name, user.last_name);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: Event): void {
    this.isDropdownOpen = false;
  }

  onProfile(): void {
    this.isDropdownOpen = false;
    this.router.navigate(['/dashboard/profile']);
  }

  onSettings(): void {
    this.isDropdownOpen = false;
    this.router.navigate(['/dashboard/settings']);
  }

  onLogout(): void {
    this.isDropdownOpen = false;
    this.isLoggingOut = true;

    this.authService.logout()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Logout successful');
          this.isLoggingOut = false;

          this.toastsService.showToastAdvanced({
            title: 'Logout Successful',
            message: 'You have been successfully logged out.',
            type: ToastType.Success,
            icon: 'fas fa-check-circle',
            duration: 5000
          });

          this.router.navigate(['/authentication/signin']);
        },
        error: (error) => {
          console.error('Logout failed:', error);
          this.isLoggingOut = false;

          this.toastsService.showToastAdvanced({
            title: 'Logout Failed',
            message: 'An error occurred while logging out. Please try again.',
            type: ToastType.Error,
            icon: 'fas fa-exclamation-triangle',
            duration: 8000
          });

          // Still redirect to login even if logout API fails
          this.router.navigate(['/authentication/signin']);
        }
      });
  }

  private getInitials(firstName: string, lastName: string): string {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}` || 'U';
  }

  private getRoleDisplay(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'Administrator';
      case 'student':
        return 'Student';
      default:
        return 'User';
    }
  }
}
