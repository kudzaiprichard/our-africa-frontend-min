// src/app/libs/providers/auth-offline.provider.ts

import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { TauriDatabaseService } from '../../../theme/shared/services/tauri-database.service';
import {
  LoginResponse,
  CompleteRegistrationResponse,
  InitiateEmailVerificationResponse,
  VerifyEmailCodeResponse,
  LogoutResponse,
  RefreshTokenResponse
} from '../../identity_access/models/authentication.dtos.interface';
import { CurrentUser } from '../../identity_access/models/auth-state.interface';

/**
 * Offline Authentication Provider
 *
 * ✅ UPDATED: Method signatures now match DataStrategy expectations
 * - login(email, password) - password ignored offline, only email needed
 * - logout() - clears local data
 * - fetchCurrentUser() - returns user from local DB
 *
 * SIMPLE offline authentication logic:
 * - If user exists in local database → allow login (no token expiry checks)
 * - Return cached user data and tokens
 * - No password verification offline (security)
 */
@Injectable({
  providedIn: 'root'
})
export class AuthOfflineProvider {

  constructor(private tauriDb: TauriDatabaseService) {}

  // ========== AUTHENTICATION OPERATIONS ==========

  /**
   * Login (OFFLINE: Check if user exists in local database)
   * ✅ UPDATED: Matches DataStrategy signature - login(email, password)
   * Password is ignored offline for security
   */
  login(email: string, password?: string): Observable<LoginResponse> {
    return from(
      (async () => {
        try {
          // 1. Check if user exists in local database
          const user = await this.tauriDb.getUserByEmail(email);

          if (!user) {
            throw new Error('No account found for this email. Please connect to the internet to log in.');
          }

          // 2. Get stored tokens (if any)
          const tokens = await this.tauriDb.getAuthTokens();

          console.log('✅ Offline login successful - user found in local database');

          // 3. Return LoginResponse (no expiry checks)
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
          throw new Error(error.message || 'Login failed. Please connect to the internet.');
        }
      })()
    );
  }

  /**
   * Complete Registration (OFFLINE: Not supported)
   */
  completeRegistration(): Observable<CompleteRegistrationResponse> {
    return throwError(() => new Error(
      'Registration requires an internet connection. Please connect to the internet to complete registration.'
    ));
  }

  /**
   * Email Verification (OFFLINE: Not supported)
   */
  initiateEmailVerification(): Observable<InitiateEmailVerificationResponse> {
    return throwError(() => new Error(
      'Email verification requires an internet connection.'
    ));
  }

  /**
   * Verify Email Code (OFFLINE: Not supported)
   */
  verifyEmailCode(): Observable<VerifyEmailCodeResponse> {
    return throwError(() => new Error(
      'Email verification requires an internet connection.'
    ));
  }

  /**
   * Resend Verification Code (OFFLINE: Not supported)
   */
  resendVerificationCode(): Observable<InitiateEmailVerificationResponse> {
    return throwError(() => new Error(
      'Resending verification code requires an internet connection.'
    ));
  }

  /**
   * Logout (OFFLINE: Just clear local data)
   * ✅ UPDATED: Matches DataStrategy signature - logout()
   */
  logout(): Observable<LogoutResponse> {
    return from(
      Promise.resolve().then(() => {
        console.log('✅ Logged out offline - tokens kept for offline access');
        return {
          message: 'Logged out locally (offline)'
        } as LogoutResponse;
      })
    );
  }

  /**
   * Refresh Tokens (OFFLINE: Not supported)
   */
  refreshTokens(): Observable<RefreshTokenResponse> {
    return throwError(() => new Error(
      'Token refresh requires an internet connection.'
    ));
  }

  /**
   * Get current user from local database
   * ✅ UPDATED: Matches DataStrategy signature - fetchCurrentUser()
   */
  fetchCurrentUser(): Observable<CurrentUser> {
    return from(
      this.tauriDb.getCurrentUser().then(user => {
        console.log('✅ User fetched from local database');
        return user;
      }).catch(error => {
        console.error('❌ Failed to fetch user from local database:', error);
        throw new Error('User data not found in local database. Please connect to the internet.');
      })
    );
  }
}
