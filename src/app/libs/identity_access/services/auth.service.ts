import { Injectable, EventEmitter } from '@angular/core';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, map, catchError, finalize } from 'rxjs/operators';
import { TokenService } from './token.service';
import { UserDataManager } from './data-manager.service';
import { LoginRequest, LoginResponse } from '../models/authentication.dtos.interface';
import { CompleteRegistrationRequest, CompleteRegistrationResponse } from '../models/authentication.dtos.interface';
import { InitiateEmailVerificationRequest, InitiateEmailVerificationResponse } from '../models/authentication.dtos.interface';
import { VerifyEmailCodeRequest, VerifyEmailCodeResponse } from '../models/authentication.dtos.interface';
import { ResendEmailCodeRequest } from '../models/authentication.dtos.interface';
import { LogoutResponse } from '../models/authentication.dtos.interface';
import { RefreshTokenResponse } from '../models/authentication.dtos.interface';
import { GetUserProfileResponse } from '../models/user-management.dtos.interface';
import { CurrentUser } from '../models/auth-state.interface';
import {API_ENDPOINTS, BaseHttpService} from '../../core';
import { of } from 'rxjs';
import {ConnectivityService} from '../../../theme/shared/services/connectivity.service';
import {TauriDatabaseService} from '../../../theme/shared/services/tauri-database.service';

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
    private baseHttpService: BaseHttpService,
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
   */
  initiateEmailVerification(request: InitiateEmailVerificationRequest): Observable<InitiateEmailVerificationResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.post<InitiateEmailVerificationResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_INITIATE,
      request
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Email verification initiation failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Verify email code
   */
  verifyEmailCode(request: VerifyEmailCodeRequest): Observable<VerifyEmailCodeResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.post<VerifyEmailCodeResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_CONFIRM,
      request
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Email verification failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Resend verification code
   */
  resendVerificationCode(request: ResendEmailCodeRequest): Observable<InitiateEmailVerificationResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.post<InitiateEmailVerificationResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_RESEND,
      request
    ).pipe(
      map(response => response.value!),
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
   */
  completeRegistration(request: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.post<CompleteRegistrationResponse>(
      API_ENDPOINTS.AUTH.REGISTER_COMPLETE,
      request
    ).pipe(
      tap(async response => {
        if (response.value) {
          this.handleSuccessfulAuth(response.value);

          // Save to local database for offline access
          try {
            if (response.value.access_token && response.value.refresh_token) {
              await this.tauriDb.saveAuthTokens(
                response.value.access_token.token,
                response.value.access_token.expires_at,
                response.value.refresh_token.token,
                response.value.refresh_token.expires_at
              );
              console.log('✅ Auth tokens saved to local database');
            }

            if (response.value.user) {
              // Create user data with full_name from first_name + last_name
              const userData = {
                ...response.value.user,
                full_name: `${response.value.user.first_name} ${response.value.user.last_name}`.trim()
              };
              await this.tauriDb.saveUser(userData);
              console.log('✅ User data saved to local database');
            }
          } catch (error) {
            console.error('❌ Failed to save auth data locally:', error);
          }
        }
      }),
      map(response => response.value!),
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
   */
  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    this.isLoadingSubject.next(true);

    // Always try API first for login (need fresh tokens)
    return this.baseHttpService.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      loginRequest
    ).pipe(
      tap(async response => {
        if (response.value) {
          this.handleSuccessfulAuth(response.value);

          // Save to local database for offline access
          try {
            if (response.value.access_token && response.value.refresh_token) {
              await this.tauriDb.saveAuthTokens(
                response.value.access_token.token,
                response.value.access_token.expires_at,
                response.value.refresh_token.token,
                response.value.refresh_token.expires_at
              );
              console.log('✅ Auth tokens saved to local database');
            }

            if (response.value.user) {
              // Create user data with full_name from first_name + last_name
              const userData = {
                ...response.value.user,
                full_name: `${response.value.user.first_name} ${response.value.user.last_name}`.trim()
              };
              await this.tauriDb.saveUser(userData);
              console.log('✅ User data saved to local database');
            }
          } catch (error) {
            console.error('❌ Failed to save auth data locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        this.handleAuthError(error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  /**
   * Logout user
   */
  logout(): Observable<LogoutResponse> {
    console.log('🚪 AuthService.logout() called');

    const accessToken = this.tokenService.getAccessToken();
    const refreshToken = this.tokenService.getRefreshToken();
    console.log('🎫 Token status before logout:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessTokenLength: accessToken?.length || 0
    });

    this.isLoadingSubject.next(true);

    console.log('📡 Making logout API call to:', API_ENDPOINTS.AUTH.LOGOUT);

    // Try API logout if online
    if (this.connectivityService.isOnline()) {
      return this.baseHttpService.post<LogoutResponse>(
        API_ENDPOINTS.AUTH.LOGOUT,
        {}
      ).pipe(
        tap(response => {
          console.log('✅ Logout API response received:', response);
        }),
        map(response => response.value!),
        catchError(error => {
          console.error('❌ Logout API failed:', {
            status: error.status,
            message: error.message,
            url: error.url
          });

          // If 401, token was already invalid - treat as successful logout
          if (error.status === 401) {
            console.log('ℹ️ 401 error - token already invalid, proceeding with logout');
            return of({ message: 'Logged out (token was invalid)' } as LogoutResponse);
          }

          // For other errors, still return success since we'll clear local state
          console.log('⚠️ Other error - still proceeding with local logout');
          return of({ message: 'Logged out (with API error)' } as LogoutResponse);
        }),
        finalize(() => {
          console.log('🏁 Logout finalize - clearing local state');
          this.handleLogoutWithLocalCleanup();
          this.isLoadingSubject.next(false);
        })
      );
    } else {
      // Offline - just clear local data
      console.log('📵 Offline - clearing local data only');
      this.handleLogoutWithLocalCleanup();
      this.isLoadingSubject.next(false);
      return of({ message: 'Logged out locally (offline)' } as LogoutResponse);
    }
  }

  /**
   * Handle logout with local database cleanup
   */
  private async handleLogoutWithLocalCleanup(): Promise<void> {
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

  // ========== USER DATA FETCHING ==========

  /**
   * Get current user info (for UserService to call)
   */
  fetchCurrentUser(): Observable<CurrentUser> {
    // If offline, get from local database
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - fetching user from local database');

      return new Observable(observer => {
        this.tauriDb.getCurrentUser()
          .then(user => {
            // Ensure full_name exists
            const userData = {
              ...user,
              full_name: user.full_name || `${user.first_name} ${user.last_name}`.trim()
            };
            this.userDataFetched.emit(userData);
            observer.next(userData);
            observer.complete();
          })
          .catch(error => {
            console.error('Failed to fetch user from local database:', error);
            observer.error(error);
          });
      });
    }

    // If online, fetch from API and save to local database
    return this.baseHttpService.get<GetUserProfileResponse>(
      API_ENDPOINTS.AUTH.PROFILE
    ).pipe(
      tap(async response => {
        if (response.value?.user) {
          // Create user data with full_name
          const userData = {
            ...response.value.user,
            full_name: `${response.value.user.first_name} ${response.value.user.last_name}`.trim()
          };

          // Save to local database
          try {
            await this.tauriDb.saveUser(userData);
            console.log('✅ User data saved to local database');
          } catch (error) {
            console.error('❌ Failed to save user data locally:', error);
          }

          // Emit event with user data
          this.userDataFetched.emit(userData);
        }
      }),
      map(response => {
        const user = response.value!.user;
        return {
          ...user,
          full_name: `${user.first_name} ${user.last_name}`.trim()
        };
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
   */
  refreshTokens(): Observable<RefreshTokenResponse> {
    return this.tokenService.refreshAccessToken().pipe(
      tap(refreshResponse => {
        // Store new tokens
        this.tokenService.storeTokens(
          refreshResponse.access_token.token,
          refreshResponse.refresh_token.token
        );
        this.isAuthenticatedSubject.next(true);
      }),
      catchError(error => {
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
   */
  private async initializeAuthState(): Promise<void> {
    // Check local database first (for offline capability)
    try {
      const tokens = await this.tauriDb.getAuthTokens();

      if (tokens.access_token) {
        const isExpired = await this.tauriDb.checkTokenExpired(tokens.access_token.expires_at);

        if (!isExpired) {
          // Valid token in local database
          this.isAuthenticatedSubject.next(true);
          console.log('✅ Valid tokens found in local database');

          // Try to restore user from local database
          try {
            const user = await this.tauriDb.getCurrentUser();
            this.authStateRestored.emit(true);
            this.userDataFetched.emit(user);
            console.log('✅ User restored from local database');
          } catch (error) {
            console.warn('⚠️ Failed to restore user from local database');
          }

          // If online, fetch fresh data in background
          if (this.connectivityService.isOnline()) {
            this.fetchCurrentUser().subscribe({
              next: () => console.log('✅ Fresh user data loaded from API'),
              error: (error) => console.warn('⚠️ Failed to refresh user data from API:', error)
            });
          }

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

      // Fetch from API if online
      if (this.connectivityService.isOnline()) {
        this.fetchCurrentUser().subscribe({
          next: () => console.log('✅ User data loaded from API'),
          error: (error) => console.warn('⚠️ Failed to load user data from API:', error)
        });
      }
    } else {
      console.log('❌ No valid tokens found');
    }
  }

  /**
   * Handle successful authentication
   */
  private handleSuccessfulAuth(authResponse: LoginResponse | CompleteRegistrationResponse): void {
    // Store tokens if present
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
   * Handle logout (clear tokens and emit logout event)
   */
  private handleLogout(): void {
    this.tokenService.clearTokens();
    this.isAuthenticatedSubject.next(false);

    // Emit logout event - UserService will listen and clear user data + storage
    this.logoutInitiated.emit();
  }
}
