// src/app/libs/authentication/services/auth.service.ts

import { Injectable, EventEmitter } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { AuthProvider } from '../providers/auth.provider';
import { TokenService } from './token.service';
import { UserDataManager } from './data-manager.service';
import { TauriDatabaseService } from '../../../theme/shared/services/tauri-database.service';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';

// DTOs
import {
  LoginRequest,
  LoginResponse,
  CompleteRegistrationRequest,
  CompleteRegistrationResponse,
  InitiateEmailVerificationRequest,
  InitiateEmailVerificationResponse,
  VerifyEmailCodeRequest,
  VerifyEmailCodeResponse,
  ResendEmailCodeRequest,
  LogoutResponse,
  RefreshTokenResponse
} from '../models/authentication.dtos.interface';
import { CurrentUser } from '../models/auth-state.interface';

/**
 * Simplified Auth Service
 * Just delegates to AuthProvider (which handles online/offline internally)
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
    private authProvider: AuthProvider,
    private tokenService: TokenService,
    private userDataManager: UserDataManager,
    private connectivity: ConnectivityService,
    private db: TauriDatabaseService
  ) {
    this.initializeAuthState();
  }

  // ============================================================================
  // EMAIL VERIFICATION FLOW
  // ============================================================================

  initiateEmailVerification(request: InitiateEmailVerificationRequest): Observable<InitiateEmailVerificationResponse> {
    this.isLoadingSubject.next(true);

    return this.authProvider.initiateEmailVerification(request).pipe(
      catchError(error => {
        console.error('Email verification initiation failed:', error);
        throw error;
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  verifyEmailCode(request: VerifyEmailCodeRequest): Observable<VerifyEmailCodeResponse> {
    this.isLoadingSubject.next(true);

    return this.authProvider.verifyEmailCode(request).pipe(
      catchError(error => {
        console.error('Email verification failed:', error);
        throw error;
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  resendVerificationCode(request: ResendEmailCodeRequest): Observable<InitiateEmailVerificationResponse> {
    this.isLoadingSubject.next(true);

    return this.authProvider.resendVerificationCode(request).pipe(
      catchError(error => {
        console.error('Resend verification failed:', error);
        throw error;
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // REGISTRATION FLOW
  // ============================================================================

  completeRegistration(request: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    this.isLoadingSubject.next(true);

    return this.authProvider.completeRegistration(request).pipe(
      tap(response => {
        this.handleSuccessfulAuth(response);
      }),
      catchError(error => {
        this.handleAuthError(error);
        throw error;
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // AUTHENTICATION FLOWS
  // ============================================================================

  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    this.isLoadingSubject.next(true);

    console.log('🔐 Login attempt');

    return this.authProvider.login(loginRequest).pipe(
      tap(response => {
        this.handleSuccessfulAuth(response);
      }),
      catchError(error => {
        this.handleAuthError(error);
        throw error;
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  logout(): Observable<LogoutResponse> {
    console.log('🚪 AuthService.logout() called');
    this.isLoadingSubject.next(true);

    return this.authProvider.logout().pipe(
      catchError(error => {
        console.error('❌ Logout error:', error);
        // Always proceed with local logout even if API call fails
        return of({ message: 'Logged out locally' } as LogoutResponse);
      }),
      finalize(async () => {
        console.log('🏁 Logout finalize - clearing local state');
        await this.handleLogoutCleanup();
        this.isLoadingSubject.next(false);
      })
    );
  }

  // ============================================================================
  // USER DATA FETCHING
  // ============================================================================

  fetchCurrentUser(): Observable<CurrentUser> {
    console.log('👤 Fetching user');

    return this.authProvider.fetchCurrentUser().pipe(
      tap(user => {
        // Emit event with user data
        this.userDataFetched.emit(user);
      }),
      catchError(error => {
        this.handleAuthError(error);
        throw error;
      })
    );
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  refreshTokens(): Observable<RefreshTokenResponse> {
    const refreshToken = this.tokenService.getRefreshToken();

    if (!refreshToken) {
      console.error('No refresh token available');
      this.handleLogout();
      throw new Error('No refresh token available');
    }

    return this.authProvider.refreshTokens(refreshToken).pipe(
      tap(refreshResponse => {
        // Store new tokens in memory
        this.tokenService.storeTokens(
          refreshResponse.access_token.token,
          refreshResponse.refresh_token.token
        );

        this.isAuthenticatedSubject.next(true);
      }),
      catchError(error => {
        console.error('❌ Token refresh failed:', error);
        this.handleLogout();
        throw error;
      })
    );
  }

  // ============================================================================
  // AUTH STATE CHECKING
  // ============================================================================

  isAuthenticated(): boolean {
    return this.tokenService.hasValidTokens();
  }

  isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Initialize authentication state on app startup
   */
  private async initializeAuthState(): Promise<void> {
    console.log('🔐 Initializing authentication state...');

    // Check if we're offline
    const isOffline = this.connectivity.isOffline();

    if (isOffline) {
      console.log('📵 Offline - checking local database for valid session');

      try {
        const tokens = await this.db.getAuthTokens();

        if (tokens.access_token) {
          console.log('✅ Offline access granted - tokens found in local database');

          // Store tokens in memory
          this.tokenService.storeTokens(
            tokens.access_token.token,
            tokens.refresh_token?.token || ''
          );

          // Update authentication state
          this.isAuthenticatedSubject.next(true);
          this.authStateRestored.emit(true);

          // Try to restore user from local database
          try {
            const user = await this.db.getCurrentUser();
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
      const tokens = await this.db.getAuthTokens();

      if (tokens.access_token) {
        const isExpired = await this.db.checkTokenExpired(tokens.access_token.expires_at);

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
            const user = await this.db.getCurrentUser();
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

    // Fallback to memory tokens
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
   * Handle successful authentication
   */
  private handleSuccessfulAuth(
    authResponse: LoginResponse | CompleteRegistrationResponse
  ): void {
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
   */
  private async handleLogoutCleanup(): Promise<void> {
    // Clear memory tokens
    this.tokenService.clearTokens();
    this.isAuthenticatedSubject.next(false);

    // Note: We don't clear user data or tokens from local DB
    // This allows offline access after logout

    // Emit logout event
    this.logoutInitiated.emit();
  }

  /**
   * Handle logout (clear tokens and emit logout event)
   */
  private handleLogout(): void {
    this.tokenService.clearTokens();
    this.isAuthenticatedSubject.next(false);

    // Emit logout event - UserService will listen and clear user data + storage
    this.logoutInitiated.emit();
  }
}
