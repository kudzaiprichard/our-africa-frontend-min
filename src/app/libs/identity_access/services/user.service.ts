import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CurrentUser } from '../models/auth-state.interface';
import { UserDataManager } from './data-manager.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  // Angular Signals approach (recommended for Angular 16+)
  private currentUserSignal = signal<CurrentUser | null>(null);

  // RxJS approach (for compatibility)
  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);

  constructor(
    private userDataManager: UserDataManager,
    private authService: AuthService
  ) {
    console.log('🔍 UserService constructor - Storage check:', this.userDataManager.restoreUserData());
    this.setupEventListeners();
  }

  // ========== EVENT LISTENERS ==========

  /**
   * Setup listeners for AuthService events
   */
  private setupEventListeners(): void {
    // Listen for future auth state restoration events
    this.authService.authStateRestored.subscribe(() => {
      console.log('📡 UserService - Received authStateRestored event');
      this.restoreUserFromStorage();
    });

    // IMMEDIATE CHECK: If already authenticated, restore now
    if (this.authService.isAuthenticated()) {
      console.log('📡 UserService - Already authenticated, restoring immediately');
      this.restoreUserFromStorage();
    }

    // Listen for fresh user data from API
    this.authService.userDataFetched.subscribe((userData) => {
      this.setCurrentUser(userData);
    });

    // Listen for logout events
    this.authService.logoutInitiated.subscribe(() => {
      this.clearUserAndStorage();
    });
  }

  // ========== USER DATA MANAGEMENT ==========

  /**
   * Set current user from user data
   */
  setCurrentUser(userData: CurrentUser): void {
    // Update in-memory state
    this.currentUserSignal.set(userData);
    this.currentUserSubject.next(userData);

    // Save to persistent storage
    this.userDataManager.saveUserData(userData);

    console.log('User data set and saved to storage');
  }

  /**
   * Restore user data from storage (called on app startup)
   */
  private restoreUserFromStorage(): void {
    const storedUserData = this.userDataManager.restoreUserData();

    if (storedUserData) {
      this.setCurrentUserFromStored(storedUserData);
      console.log('User data restored from storage');

      // Optionally fetch fresh data from API (non-blocking)
      this.refreshUserDataFromAPI();
    } else {
      console.log('No stored user data found');
    }
  }

  /**
   * Set user data from stored data (without re-saving to storage)
   */
  private setCurrentUserFromStored(userData: CurrentUser): void {
    console.log('🔄 Setting user from stored data:', userData);

    // Only update in-memory state, don't save to storage again
    this.currentUserSignal.set(userData);
    this.currentUserSubject.next(userData);

    console.log('🔄 Signals updated. Current user:', this.getCurrentUserValue());
  }

  /**
   * Refresh user data from API (non-blocking background operation)
   */
  private refreshUserDataFromAPI(): void {
    this.authService.fetchCurrentUser().subscribe({
      next: (userData) => {
        console.log('User data refreshed from API');
      },
      error: (error) => {
        console.warn('Failed to refresh user data from API, using cached data:', error);
      }
    });
  }

  /**
   * Clear current user and storage
   */
  clearUserAndStorage(): void {
    // Clear in-memory state
    this.currentUserSignal.set(null);
    this.currentUserSubject.next(null);

    // Clear persistent storage
    this.userDataManager.clearUserData();

    console.log('User data cleared from memory and storage');
  }

  /**
   * Clear current user (logout) - public method for external calls
   */
  clearCurrentUser(): void {
    this.clearUserAndStorage();
  }

  // ========== USER STATE ACCESS ==========

  /**
   * Get current user (Signal approach)
   */
  getCurrentUser = computed(() => this.currentUserSignal());

  /**
   * Get current user observable (RxJS approach)
   */
  getCurrentUser$(): Observable<CurrentUser | null> {
    return this.currentUserSubject.asObservable();
  }

  /**
   * Get current user value (synchronous)
   */
  getCurrentUserValue(): CurrentUser | null {
    return this.currentUserSignal();
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn = computed(() => this.currentUserSignal() !== null);

  /**
   * Get user's full name
   */
  getFullName = computed(() => {
    const user = this.currentUserSignal();
    return user ? `${user.first_name} ${user.last_name}`.trim() : 'Guest';
  });

  /**
   * Get user's email
   */
  getEmail = computed(() => {
    const user = this.currentUserSignal();
    return user?.email || '';
  });

  /**
   * Get user's role
   */
  getUserRole = computed(() => {
    const user = this.currentUserSignal();
    return user?.role || null;
  });

  /**
   * Get user's ID
   */
  getUserId = computed(() => {
    const user = this.currentUserSignal();
    return user?.id || null;
  });

  // ========== USER ROLE CHECKING ==========

  /**
   * Check if user is admin
   */
  isAdmin = computed(() => {
    const role = this.getUserRole();
    return role === 'admin';
  });

  /**
   * Check if user is student
   */
  isStudent = computed(() => {
    const role = this.getUserRole();
    return role === 'student';
  });

  // ========== PERMISSION HELPERS ==========

  /**
   * Check if user can manage users
   */
  canManageUsers = computed(() => {
    return this.isAdmin();
  });

  /**
   * Get user role display name
   */
  getUserRoleDisplay = computed(() => {
    const role = this.getUserRole();
    return role === 'admin' ? 'Administrator' : role === 'student' ? 'Student' : 'Guest';
  });

  /**
   * Check if user's email is verified
   */
  isEmailVerified = computed(() => {
    const user = this.currentUserSignal();
    return user?.email_verified || false;
  });

  /**
   * Check if user account is active
   */
  isActive = computed(() => {
    const user = this.currentUserSignal();
    return user?.is_active || false;
  });
}
