// src/app/libs/authentication/providers/auth.provider.ts

import { Injectable } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { BaseHttpService, API_ENDPOINTS } from '../../core';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';
import { TauriDatabaseService } from '../../../theme/shared/services/tauri-database.service';

// Auth DTOs
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
  RefreshTokenResponse,
  RefreshTokenRequest
} from '../models/authentication.dtos.interface';
import { CurrentUser } from '../models/auth-state.interface';
import { GetUserProfileResponse } from '../models/user-management.dtos.interface';

/**
 * Unified Auth Provider
 * Handles both online API calls and offline local database operations
 *
 * Simple pattern:
 * - Check if online/offline
 * - If online: call API + save to local DB
 * - If offline: read from local DB (login only)
 */
@Injectable({
  providedIn: 'root'
})
export class AuthProvider {

  constructor(
    private http: BaseHttpService,
    private connectivity: ConnectivityService,
    private db: TauriDatabaseService
  ) {}

  // ============================================================================
  // EMAIL VERIFICATION FLOW (Always requires internet)
  // ============================================================================

  initiateEmailVerification(request: InitiateEmailVerificationRequest): Observable<InitiateEmailVerificationResponse> {
    if (this.connectivity.isOffline()) {
      return throwError(() => new Error(
        'Email verification requires an internet connection.'
      ));
    }

    return this.http.post<InitiateEmailVerificationResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_INITIATE,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  verifyEmailCode(request: VerifyEmailCodeRequest): Observable<VerifyEmailCodeResponse> {
    if (this.connectivity.isOffline()) {
      return throwError(() => new Error(
        'Email verification requires an internet connection.'
      ));
    }

    return this.http.post<VerifyEmailCodeResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_CONFIRM,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  resendVerificationCode(request: ResendEmailCodeRequest): Observable<InitiateEmailVerificationResponse> {
    if (this.connectivity.isOffline()) {
      return throwError(() => new Error(
        'Resending verification code requires an internet connection.'
      ));
    }

    return this.http.post<InitiateEmailVerificationResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_RESEND,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  // ============================================================================
  // REGISTRATION FLOW (Always requires internet)
  // ============================================================================

  completeRegistration(request: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    if (this.connectivity.isOffline()) {
      return throwError(() => new Error(
        'Registration requires an internet connection.'
      ));
    }

    return this.http.post<CompleteRegistrationResponse>(
      API_ENDPOINTS.AUTH.REGISTER_COMPLETE,
      request
    ).pipe(
      map(response => response.value!),
      tap(async response => {
        // Save auth data locally for offline access
        await this.saveAuthDataLocally(response);
      })
    );
  }

  // ============================================================================
  // AUTHENTICATION FLOWS
  // ============================================================================

  login(request: LoginRequest): Observable<LoginResponse> {
    if (this.connectivity.isOffline()) {
      return this.loginOffline(request.email);
    }

    return this.http.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      request
    ).pipe(
      map(response => response.value!),
      tap(async response => {
        // Save auth data locally for offline access
        await this.saveAuthDataLocally(response);
      })
    );
  }

  logout(): Observable<LogoutResponse> {
    if (this.connectivity.isOffline()) {
      return this.logoutOffline();
    }

    return this.http.post<LogoutResponse>(
      API_ENDPOINTS.AUTH.LOGOUT,
      {}
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        // If 401, token was already invalid - treat as successful logout
        if (error.status === 401) {
          console.log('Token already invalid, proceeding with logout');
          return of({ message: 'Logged out (token was invalid)' } as LogoutResponse);
        }

        // For other errors, still proceed with local logout
        console.log('Error during logout, still proceeding with local cleanup');
        return of({ message: 'Logged out (with error)' } as LogoutResponse);
      })
    );
  }

  // ============================================================================
  // USER DATA FETCHING
  // ============================================================================

  fetchCurrentUser(): Observable<CurrentUser> {
    if (this.connectivity.isOffline()) {
      return this.fetchCurrentUserOffline();
    }

    return this.http.get<GetUserProfileResponse>(
      API_ENDPOINTS.AUTH.PROFILE
    ).pipe(
      map(response => {
        const user = response.value!.user;
        return {
          ...user,
          full_name: `${user.first_name} ${user.last_name}`.trim()
        };
      }),
      tap(async user => {
        // Save user data locally
        await this.saveUserToLocal(user);
      })
    );
  }

  // ============================================================================
  // TOKEN MANAGEMENT (Always requires internet)
  // ============================================================================

  refreshTokens(refreshToken: string): Observable<RefreshTokenResponse> {
    if (this.connectivity.isOffline()) {
      return throwError(() => new Error(
        'Token refresh requires an internet connection.'
      ));
    }

    const request: RefreshTokenRequest = {
      refresh_token: refreshToken
    };

    return this.http.post<RefreshTokenResponse>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      request
    ).pipe(
      map(response => response.value!),
      tap(async refreshResponse => {
        // Save new tokens locally
        try {
          await this.db.saveAuthTokens(
            refreshResponse.access_token.token,
            refreshResponse.access_token.expires_at,
            refreshResponse.refresh_token.token,
            refreshResponse.refresh_token.expires_at
          );
          console.log('✅ Refreshed tokens saved to local database');
        } catch (error) {
          console.error('❌ Failed to save refreshed tokens locally:', error);
        }
      })
    );
  }

  // ============================================================================
  // OFFLINE IMPLEMENTATIONS
  // ============================================================================

  private loginOffline(email: string): Observable<LoginResponse> {
    return from(
      (async () => {
        try {
          // 1. Check if user exists in local database
          const user = await this.db.getUserByEmail(email);

          if (!user) {
            throw new Error(
              'No account found for this email. Please connect to the internet to log in.'
            );
          }

          // 2. Get stored tokens (if any)
          const tokens = await this.db.getAuthTokens();

          console.log('✅ Offline login successful - user found in local database');

          // 3. Return LoginResponse (no expiry checks offline)
          return {
            message: 'Logged in offline using cached credentials',
            user: user,
            access_token: tokens.access_token ? {
              token: tokens.access_token.token,
              expires_at: tokens.access_token.expires_at
            } : undefined,
            refresh_token: tokens.refresh_token ? {
              token: tokens.refresh_token.token,
              expires_at: tokens.refresh_token.expires_at
            } : undefined
          } as LoginResponse;

        } catch (error: any) {
          console.error('❌ Offline login failed:', error);
          throw new Error(
            error.message || 'Login failed. Please connect to the internet.'
          );
        }
      })()
    );
  }

  private logoutOffline(): Observable<LogoutResponse> {
    return from(
      Promise.resolve().then(() => {
        console.log('✅ Logged out offline - tokens kept for offline access');
        return {
          message: 'Logged out locally (offline)'
        } as LogoutResponse;
      })
    );
  }

  private fetchCurrentUserOffline(): Observable<CurrentUser> {
    return from(
      this.db.getCurrentUser().then(user => {
        console.log('✅ User fetched from local database');
        return user;
      }).catch(error => {
        console.error('❌ Failed to fetch user from local database:', error);
        throw new Error(
          'User data not found in local database. Please connect to the internet.'
        );
      })
    );
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Save authentication data to local database
   */
  private async saveAuthDataLocally(
    authResponse: LoginResponse | CompleteRegistrationResponse
  ): Promise<void> {
    try {
      // Save tokens
      if (authResponse.access_token && authResponse.refresh_token) {
        await this.db.saveAuthTokens(
          authResponse.access_token.token,
          authResponse.access_token.expires_at,
          authResponse.refresh_token.token,
          authResponse.refresh_token.expires_at
        );
        console.log('✅ Auth tokens saved to local database');
      }

      // Save user data
      if (authResponse.user) {
        await this.saveUserToLocal(authResponse.user);
      }
    } catch (error) {
      console.error('❌ Failed to save auth data locally:', error);
    }
  }

  /**
   * Save user data to local database
   */
  private async saveUserToLocal(user: any): Promise<void> {
    try {
      const userData = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        middle_name: user.middle_name || null,
        last_name: user.last_name,
        full_name: user.full_name || `${user.first_name} ${user.last_name}`.trim(),
        bio: user.bio || null,
        phone_number: user.phone_number || null,
        role: user.role,
        is_active: user.is_active ?? true,
        profile_image_url: user.profile_image_url || null,
        profile_image_file_id: user.profile_image_file_id || null,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString()
      };

      await this.db.saveUser(userData);
      console.log('✅ User data saved to local database');
    } catch (error) {
      console.error('❌ Failed to save user data locally:', error);
    }
  }

  /**
   * Check if we have valid local auth data
   */
  async hasValidLocalAuth(): Promise<boolean> {
    try {
      const tokens = await this.db.getAuthTokens();
      const user = await this.db.getCurrentUser();
      return !!(tokens.access_token && user);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get tokens from local database
   */
  async getLocalTokens(): Promise<{ access_token: any | null; refresh_token: any | null }> {
    try {
      return await this.db.getAuthTokens();
    } catch (error) {
      console.error('Failed to get local tokens:', error);
      return { access_token: null, refresh_token: null };
    }
  }

  /**
   * Clear local auth tokens (but keep user data for offline access)
   */
  async clearLocalTokens(): Promise<void> {
    try {
      await this.db.clearAuthTokens();
      console.log('✅ Local auth tokens cleared');
    } catch (error) {
      console.error('❌ Failed to clear local auth tokens:', error);
    }
  }
}
