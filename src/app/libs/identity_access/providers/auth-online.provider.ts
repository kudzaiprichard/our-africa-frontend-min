// src/app/libs/providers/auth-online.provider.ts

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseHttpService, API_ENDPOINTS } from '../../core';
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
} from '../../identity_access/models/authentication.dtos.interface';
import { GetUserProfileResponse } from '../../identity_access/models/user-management.dtos.interface';
import { CurrentUser } from '../../identity_access/models/auth-state.interface';

/**
 * Online Authentication Provider
 * Handles all HTTP API calls for authentication operations
 *
 * ✅ UPDATED: Method signatures now match DataStrategy expectations
 * - login(email, password) - builds LoginRequest internally
 * - logout() - no parameters needed
 * - fetchCurrentUser() - no parameters needed
 */
@Injectable({
  providedIn: 'root'
})
export class AuthOnlineProvider {

  constructor(private baseHttpService: BaseHttpService) {}

  // ========== EMAIL VERIFICATION FLOW ==========

  /**
   * Initiate email verification - sends 6-digit code
   */
  initiateEmailVerification(request: InitiateEmailVerificationRequest): Observable<InitiateEmailVerificationResponse> {
    return this.baseHttpService.post<InitiateEmailVerificationResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_INITIATE,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Verify email code
   */
  verifyEmailCode(request: VerifyEmailCodeRequest): Observable<VerifyEmailCodeResponse> {
    return this.baseHttpService.post<VerifyEmailCodeResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_CONFIRM,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Resend verification code
   */
  resendVerificationCode(request: ResendEmailCodeRequest): Observable<InitiateEmailVerificationResponse> {
    return this.baseHttpService.post<InitiateEmailVerificationResponse>(
      API_ENDPOINTS.AUTH.EMAIL_VERIFY_RESEND,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== REGISTRATION FLOW ==========

  /**
   * Complete registration after email verification
   */
  completeRegistration(request: CompleteRegistrationRequest): Observable<CompleteRegistrationResponse> {
    return this.baseHttpService.post<CompleteRegistrationResponse>(
      API_ENDPOINTS.AUTH.REGISTER_COMPLETE,
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== AUTHENTICATION FLOWS ==========

  /**
   * Login user
   * ✅ UPDATED: Matches DataStrategy signature - login(email, password)
   * Builds LoginRequest internally
   */
  login(email: string, password: string): Observable<LoginResponse> {
    const loginRequest: LoginRequest = {
      email,
      password
    };

    return this.baseHttpService.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      loginRequest
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Logout user
   * ✅ UPDATED: Matches DataStrategy signature - logout()
   */
  logout(): Observable<LogoutResponse> {
    return this.baseHttpService.post<LogoutResponse>(
      API_ENDPOINTS.AUTH.LOGOUT,
      {}
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== USER DATA FETCHING ==========

  /**
   * Get current user profile
   * ✅ UPDATED: Matches DataStrategy signature - fetchCurrentUser()
   */
  fetchCurrentUser(): Observable<CurrentUser> {
    return this.baseHttpService.get<GetUserProfileResponse>(
      API_ENDPOINTS.AUTH.PROFILE
    ).pipe(
      map(response => {
        const user = response.value!.user;
        // Ensure full_name is present
        return {
          ...user,
          full_name: `${user.first_name} ${user.last_name}`.trim()
        };
      })
    );
  }

  // ========== TOKEN MANAGEMENT ==========

  /**
   * Refresh authentication tokens
   */
  refreshTokens(refreshToken: string): Observable<RefreshTokenResponse> {
    const request: RefreshTokenRequest = {
      refresh_token: refreshToken
    };

    return this.baseHttpService.post<RefreshTokenResponse>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      request
    ).pipe(
      map(response => response.value!)
    );
  }
}
