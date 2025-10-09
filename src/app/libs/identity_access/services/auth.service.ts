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
    private userDataManager: UserDataManager
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
      tap(response => {
        if (response.value) {
          this.handleSuccessfulAuth(response.value);
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

    return this.baseHttpService.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      loginRequest
    ).pipe(
      tap(response => {
        if (response.value) {
          this.handleSuccessfulAuth(response.value);
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

    // Emit logout event first
    this.logoutInitiated.emit();

    console.log('📡 Making logout API call to:', API_ENDPOINTS.AUTH.LOGOUT);

    return this.baseHttpService.post<LogoutResponse>(
      API_ENDPOINTS.AUTH.LOGOUT,
      {}
    ).pipe(
      tap(response => {
        console.log('✅ Logout API response received:', response);
        if (response.value) {
          this.handleLogout();
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('❌ Logout API failed:', {
          status: error.status,
          message: error.message,
          url: error.url
        });

        // Even if logout fails on server, clear local state
        this.handleLogout();
        return throwError(() => error);
      }),
      finalize(() => {
        console.log('🏁 Logout process finalized');
        this.isLoadingSubject.next(false);
      })
    );
  }

  // ========== USER DATA FETCHING ==========

  /**
   * Get current user info (for UserService to call)
   */
  fetchCurrentUser(): Observable<CurrentUser> {
    return this.baseHttpService.get<GetUserProfileResponse>(
      API_ENDPOINTS.AUTH.PROFILE
    ).pipe(
      tap(response => {
        if (response.value?.user) {
          // Emit event with user data - UserService will listen and handle storage
          this.userDataFetched.emit(response.value.user);
        }
      }),
      map(response => response.value!.user),
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
  private initializeAuthState(): void {
    const hasValidTokens = this.tokenService.hasValidTokens();
    this.isAuthenticatedSubject.next(hasValidTokens);

    if (hasValidTokens) {
      console.log('Valid tokens found, emitting auth restored event');

      // Emit event IMMEDIATELY - UserService will restore from storage
      this.authStateRestored.emit(true);

      // THEN fetch fresh data from API (non-blocking)
      this.fetchCurrentUser().subscribe({
        next: (userData) => {
          console.log('Fresh user data loaded from API');
        },
        error: (error) => {
          console.warn('Failed to refresh user data from API, using cached data:', error);
        }
      });
    } else {
      console.log('No valid tokens found');
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
