// src/app/libs/authentication/services/auth.service.ts

import { Injectable, EventEmitter } from '@angular/core';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { TokenService } from './token.service';
import { UserDataManager } from './data-manager.service';
import { LoginRequest, LoginResponse } from '../models/authentication.dtos.interface';
import { CompleteRegistrationRequest, CompleteRegistrationResponse } from '../models/authentication.dtos.interface';
import { InitiateEmailVerificationRequest, InitiateEmailVerificationResponse } from '../models/authentication.dtos.interface';
import { VerifyEmailCodeRequest, VerifyEmailCodeResponse } from '../models/authentication.dtos.interface';
import { ResendEmailCodeRequest } from '../models/authentication.dtos.interface';
import { LogoutResponse } from '../models/authentication.dtos.interface';
import { RefreshTokenResponse } from '../models/authentication.dtos.interface';
import { CurrentUser } from '../models/auth-state.interface';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';
import { TauriDatabaseService } from '../../../theme/shared/services/tauri-database.service';
import { DataStrategyService } from '../../../theme/shared/services/data-strategy.service';
import { AuthOnlineProvider } from '../providers/auth-online.provider';
import { AuthOfflineProvider } from '../providers/auth-offline.provider';

/**
 * Refactored AuthService - Uses DataStrategyService for clean online/offline separation
 *
 * ✅ NEW: Uses DataStrategyService pattern (consistent with CourseService)
 * ✅ Maintains all existing functionality
 * ✅ No breaking changes to external API
 *
 * Key Features:
 * - Uses DataStrategyService for automatic online/offline routing
 * - Uses AuthOnlineProvider for API operations
 * - Uses AuthOfflineProvider for offline access
 * - Automatic offline authentication (if user logged in previously)
 * - Saves tokens and user data to local DB for offline use
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  // Events for other services to listen to
  public authStateRestored = new EventEmitter<boolean>();
  public userDataFetched = new EventEmitter<CurrentUser>();
  public logoutInitiated = new EventEmitter<void>();

  constructor(
    private dataStrategy: DataStrategyService,
    private authOnline: AuthOnlineProvider,
    private authOffline: AuthOfflineProvider,
    private tokenService: TokenService,
    private userDataManager: UserDataManager,
    private connectivityService: ConnectivityService,
    private tauriDb: TauriDatabaseService
  ) {
    this.initializeAuthState();
  }

  // ========== EMAIL VERIFICATION FLOW ==========

  /**
   * Initiate email verification - sends 6-digit code
   * (Always requires internet - no offline fallback)
   */
  initiateEmailVerification(request: InitiateEmailVerificationRequest): Observable<InitiateEmailVerificationResponse> {
    this.isLoadingSubject.next(true);

    // ✅ These operations ALWAYS require internet - call online provider directly
    return this.authOnline.initiateEmailVerification(request).pipe(
      catchError(error => {
        console.error('Email verification initiation failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Verify email code
   * (Always requires internet - no offline fallback)
   */
  verifyEmailCode(request: VerifyEmailCodeRequest): Observable<VerifyEmailCodeResponse> {
    this.isLoadingSubject.next(true);

    return this.authOnline.verifyEmailCode(request).pipe(
      catchError(error => {
        console.error('Email verification failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Resend verification code
   * (Always requires internet - no offline fallback)
   */
  resendVerificationCode(request: ResendEmailCodeRequest): Observable<InitiateEmailVerificationResponse> {
    this.isLoadingSubject.next(true);

    return this.authOnline.resendVerificationCode(request).pipe(
      catchError(error => {
        console.error('Resend verification failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== REGISTRATION FLOW ==========

  /**
   * Complete registration after email verification
   * (Always requires internet - saves locally after success)
   */
  completeRegistration(request: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    this.isLoadingSubject.next(true);

    return this.authOnline.completeRegistration(request).pipe(
      tap(async response => {
        this.handleSuccessfulAuth(response);

        // Save to local database for offline access
        await this.saveAuthDataLocally(response);
      }),
      catchError(error => {
        this.handleAuthError(error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== AUTHENTICATION FLOWS ==========

  /**
   * Login user
   * ✅ NEW: Uses DataStrategyService for automatic online/offline routing
   */
  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    this.isLoadingSubject.next(true);

    console.log('🔐 Login attempt via DataStrategy');

    // ✅ Use DataStrategyService - it will handle online/offline routing
    return this.dataStrategy.execute<LoginResponse>(
      'login',
      this.authOnline,
      this.authOffline,
      [loginRequest.email, loginRequest.password], // Offline only needs email
      {
        saveToLocal: true,    // Save auth data locally after online login
        queueIfOffline: false, // Login is immediate, no queueing needed
        readOnly: false
      }
    ).pipe(
      tap(async response => {
        this.handleSuccessfulAuth(response);

        // ✅ Save to local database ONLY when online (DataStrategy already handles this)
        // But we need to do it here for the auth-specific logic
        const isOffline = this.connectivityService.isOffline();
        if (!isOffline) {
          await this.saveAuthDataLocally(response);
        }
      }),
      catchError(error => {
        this.handleAuthError(error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Logout user
   * ✅ NEW: Uses DataStrategyService for automatic online/offline routing
   */
  logout(): Observable<LogoutResponse> {
    console.log('🚪 AuthService.logout() called');
    this.isLoadingSubject.next(true);

    // ✅ Use DataStrategyService
    return this.dataStrategy.execute<LogoutResponse>(
      'logout',
      this.authOnline,
      this.authOffline,
      [],
      {
        readOnly: false,
        queueIfOffline: false // Logout is immediate, no queueing
      }
    ).pipe(
      catchError(error => {
        console.error('❌ Logout error:', error);

        // If 401, token was already invalid - treat as successful logout
        if (error.status === 401) {
          console.log('ℹ️ 401 error - token already invalid, proceeding with logout');
          return of({ message: 'Logged out (token was invalid)' } as LogoutResponse);
        }

        // For other errors, still proceed with local logout
        console.log('⚠️ Error during logout - still proceeding with local cleanup');
        return of({ message: 'Logged out (with error)' } as LogoutResponse);
      }),
      finalize(async () => {
        console.log('🏁 Logout finalize - clearing local state');
        await this.handleLogoutCleanup();
        this.isLoadingSubject.next(false);
      })
    );
  }

  // ========== USER DATA FETCHING ==========

  /**
   * Get current user info (for UserService to call)
   * ✅ NEW: Uses DataStrategyService for automatic online/offline routing
   */
  fetchCurrentUser(): Observable<CurrentUser> {
    console.log('👤 Fetching user via DataStrategy');

    // ✅ Use DataStrategyService
    return this.dataStrategy.execute<CurrentUser>(
      'fetchCurrentUser',
      this.authOnline,
      this.authOffline,
      [],
      {
        saveToLocal: true, // Save user data locally after online fetch
        readOnly: true
      }
    ).pipe(
      tap(async user => {
        // Emit event with user data
        this.userDataFetched.emit(user);

        // If online, save to local database (DataStrategy handles this, but we do it for auth-specific logic)
        const isOffline = this.connectivityService.isOffline();
        if (!isOffline) {
          try {
            await this.tauriDb.saveUser(user);
            console.log('✅ User data saved to local database');
          } catch (error) {
            console.error('❌ Failed to save user data locally:', error);
          }
        }
      }),
      catchError(error => {
        this.handleAuthError(error);
        return throwError(() => error);
      })
    );
  }

  // ========== TOKEN MANAGEMENT ==========

  /**
   * Refresh authentication tokens
   * (Only works online - no offline fallback)
   */
  refreshTokens(): Observable<RefreshTokenResponse> {
    const refreshToken = this.tokenService.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    // ✅ Token refresh ALWAYS requires internet - call online provider directly
    return this.authOnline.refreshTokens(refreshToken).pipe(
      tap(async refreshResponse => {
        // Store new tokens in memory
        this.tokenService.storeTokens(
          refreshResponse.access_token.token,
          refreshResponse.refresh_token.token
        );

        // Store new tokens in local database
        try {
          await this.tauriDb.saveAuthTokens(
            refreshResponse.access_token.token,
            refreshResponse.access_token.expires_at,
            refreshResponse.refresh_token.token,
            refreshResponse.refresh_token.expires_at
          );
          console.log('✅ Refreshed tokens saved to local database');
        } catch (error) {
          console.error('❌ Failed to save refreshed tokens locally:', error);
        }

        this.isAuthenticatedSubject.next(true);
      }),
      catchError(error => {
        console.error('❌ Token refresh failed:', error);
        this.handleLogout();
        return throwError(() => error);
      })
    );
  }

  // ========== AUTH STATE CHECKING ==========

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokenService.hasValidTokens();
  }

  /**
   * Get authentication status observable
   */
  isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  /**
   * Get loading status observable
   */
  isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Initialize authentication state on app startup
   * ✅ UNCHANGED - maintains existing initialization logic
   */
  private async initializeAuthState(): Promise<void> {
    console.log('🔐 Initializing authentication state...');

    // Check if we're offline
    const isOffline = this.connectivityService.isOffline();

    if (isOffline) {
      console.log('📵 Offline - checking local database for valid session');

      // Check if user exists in local database
      try {
        const tokens = await this.tauriDb.getAuthTokens();

        if (tokens.access_token) {
          console.log('✅ Offline access granted - tokens found in local database');

          // Store tokens in memory (TokenService)
          this.tokenService.storeTokens(
            tokens.access_token.token,
            tokens.refresh_token?.token || ''
          );

          // Update authentication state
          this.isAuthenticatedSubject.next(true);
          this.authStateRestored.emit(true);

          // Try to restore user from local database
          try {
            const user = await this.tauriDb.getCurrentUser();
            this.userDataFetched.emit(user);
            console.log('✅ User restored from local database');
          } catch (error) {
            console.warn('⚠️ Failed to restore user from local database');
          }
        } else {
          console.log('❌ No valid offline session - user must connect to internet to login');
          this.isAuthenticatedSubject.next(false);
        }
      } catch (error) {
        console.error('❌ Error checking offline access:', error);
        this.isAuthenticatedSubject.next(false);
      }

      return;
    }

    // ONLINE: Check local database first, then fallback to memory
    try {
      const tokens = await this.tauriDb.getAuthTokens();

      if (tokens.access_token) {
        const isExpired = await this.tauriDb.checkTokenExpired(tokens.access_token.expires_at);

        if (!isExpired) {
          console.log('✅ Valid tokens found in local database');

          // Store in memory
          this.tokenService.storeTokens(
            tokens.access_token.token,
            tokens.refresh_token?.token || ''
          );

          this.isAuthenticatedSubject.next(true);

          // Try to restore user from local database
          try {
            const user = await this.tauriDb.getCurrentUser();
            this.authStateRestored.emit(true);
            this.userDataFetched.emit(user);
            console.log('✅ User restored from local database');
          } catch (error) {
            console.warn('⚠️ Failed to restore user from local database');
          }

          // Fetch fresh data in background (online)
          this.fetchCurrentUser().subscribe({
            next: () => console.log('✅ Fresh user data loaded from API'),
            error: (error) => console.warn('⚠️ Failed to refresh user data from API:', error)
          });

          return;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking local database tokens:', error);
    }

    // Fallback to memory tokens (TokenService)
    const hasValidTokens = this.tokenService.hasValidTokens();
    this.isAuthenticatedSubject.next(hasValidTokens);

    if (hasValidTokens) {
      console.log('✅ Valid tokens found in memory');
      this.authStateRestored.emit(true);

      // Fetch user data from API
      this.fetchCurrentUser().subscribe({
        next: () => console.log('✅ User data loaded from API'),
        error: (error) => console.warn('⚠️ Failed to load user data from API:', error)
      });
    } else {
      console.log('❌ No valid tokens found');
    }
  }

  /**
   * Save authentication data to local database
   * ✅ UNCHANGED
   */
  private async saveAuthDataLocally(authResponse: LoginResponse | CompleteRegistrationResponse): Promise<void> {
    try {
      // Save tokens
      if (authResponse.access_token && authResponse.refresh_token) {
        await this.tauriDb.saveAuthTokens(
          authResponse.access_token.token,
          authResponse.access_token.expires_at,
          authResponse.refresh_token.token,
          authResponse.refresh_token.expires_at
        );
        console.log('✅ Auth tokens saved to local database');
      }

      // Save user data
      if (authResponse.user) {
        const userData = {
          ...authResponse.user,
          full_name: `${authResponse.user.first_name} ${authResponse.user.last_name}`.trim()
        };
        await this.tauriDb.saveUser(userData);
        console.log('✅ User data saved to local database');
      }
    } catch (error) {
      console.error('❌ Failed to save auth data locally:', error);
    }
  }

  /**
   * Handle successful authentication
   * ✅ UNCHANGED
   */
  private handleSuccessfulAuth(authResponse: LoginResponse | CompleteRegistrationResponse): void {
    // Store tokens in memory if present
    if (authResponse.access_token && authResponse.refresh_token) {
      this.tokenService.storeTokens(
        authResponse.access_token.token,
        authResponse.refresh_token.token
      );
    }

    // Update authentication state
    this.isAuthenticatedSubject.next(true);

    // Emit user data - UserService will listen for the userDataFetched event
    if (authResponse.user) {
      this.userDataFetched.emit(authResponse.user);
    }
  }

  /**
   * Handle authentication errors
   * ✅ UNCHANGED
   */
  private handleAuthError(error: any): void {
    console.error('Authentication error:', error);

    // If error is 401 (Unauthorized), clear tokens
    if (error.status === 401) {
      this.handleLogout();
    }
  }

  /**
   * Handle logout cleanup
   * ✅ UNCHANGED
   */
  private async handleLogoutCleanup(): Promise<void> {
    // Clear memory tokens
    this.tokenService.clearTokens();
    this.isAuthenticatedSubject.next(false);

    // Clear local database
    try {
      await this.tauriDb.clearAuthTokens();
      console.log('✅ Local auth data cleared');
    } catch (error) {
      console.error('❌ Failed to clear local auth data:', error);
    }

    // Emit logout event
    this.logoutInitiated.emit();
  }

  /**
   * Handle logout (clear tokens and emit logout event)
   * ✅ UNCHANGED
   */
  private handleLogout(): void {
    this.tokenService.clearTokens();
    this.isAuthenticatedSubject.next(false);

    // Emit logout event - UserService will listen and clear user data + storage
    this.logoutInitiated.emit();
  }
}
