import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { RefreshTokenResponse } from '../models/authentication.dtos.interface';
import {API_ENDPOINTS, BaseHttpService, JwtUtils, StorageService} from '../../core';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  private tokenRefreshInProgress = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private storageService: StorageService,
    private baseHttpService: BaseHttpService
  ) {}

  /**
   * Store tokens after successful login/register
   */
  storeTokens(accessToken: string, refreshToken: string): void {
    this.storageService.setTokens(accessToken, refreshToken);
    this.refreshTokenSubject.next(accessToken);
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.storageService.getAccessToken();
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    return this.storageService.getRefreshToken();
  }

  /**
   * Check if user has valid tokens
   */
  hasValidTokens(): boolean {
    return this.storageService.hasValidTokens();
  }

  /**
   * Check if access token is valid (not expired)
   */
  hasValidAccessToken(): boolean {
    return this.storageService.hasValidAccessToken();
  }

  /**
   * Check if access token will expire soon
   */
  accessTokenExpiresSoon(minutesThreshold = 5): boolean {
    return this.storageService.accessTokenExpiresSoon(minutesThreshold);
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(): Observable<RefreshTokenResponse> {
    // Prevent multiple simultaneous refresh requests
    if (this.tokenRefreshInProgress) {
      return this.refreshTokenSubject.asObservable().pipe(
        switchMap(() => {
          const newToken = this.getAccessToken();
          const newRefreshToken = this.getRefreshToken();
          if (newToken && newRefreshToken) {
            return of({
              message: 'Token refreshed',
              access_token: {
                token: newToken,
                token_type: 'Bearer',
                expires_at: '',
                created_at: ''
              },
              refresh_token: {
                token: newRefreshToken,
                token_type: 'Bearer',
                expires_at: '',
                created_at: ''
              }
            } as RefreshTokenResponse);
          }
          return throwError(() => new Error('Token refresh failed'));
        })
      );
    }

    this.tokenRefreshInProgress = true;

    return this.baseHttpService.post<RefreshTokenResponse>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      {}
    ).pipe(
      tap(response => {
        if (response.value) {
          this.storeTokens(
            response.value.access_token.token,
            response.value.refresh_token.token
          );
        }
        this.tokenRefreshInProgress = false;
        this.refreshTokenSubject.next(response.value?.access_token.token || null);
      }),
      map(response => response.value!),
      catchError(error => {
        this.tokenRefreshInProgress = false;
        this.clearTokens();
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear all tokens (logout)
   */
  clearTokens(): void {
    this.storageService.clearAll();
    this.refreshTokenSubject.next(null);
  }

  /**
   * Get user ID from current access token
   */
  getCurrentUserId(): string | null {
    const token = this.getAccessToken();
    return token ? JwtUtils.getUserId(token) : null;
  }

  /**
   * Get user email from current access token
   */
  getCurrentUserEmail(): string | null {
    const token = this.getAccessToken();
    return token ? JwtUtils.getUserEmail(token) : null;
  }

  /**
   * Get user role from current access token
   */
  getCurrentUserRole(): string | null {
    const token = this.getAccessToken();
    return token ? JwtUtils.getUserRole(token) : null;
  }

  /**
   * Get first name from current access token
   */
  getCurrentUserFirstName(): string | null {
    const token = this.getAccessToken();
    return token ? JwtUtils.getFirstName(token) : null;
  }

  /**
   * Get last name from current access token
   */
  getCurrentUserLastName(): string | null {
    const token = this.getAccessToken();
    return token ? JwtUtils.getLastName(token) : null;
  }

  /**
   * Get full name from current access token
   */
  getCurrentUserFullName(): string | null {
    const token = this.getAccessToken();
    return token ? JwtUtils.getFullName(token) : null;
  }

  /**
   * Check if current user is admin
   */
  isCurrentUserAdmin(): boolean {
    const token = this.getAccessToken();
    return token ? JwtUtils.isAdmin(token) : false;
  }

  /**
   * Check if current user is student
   */
  isCurrentUserStudent(): boolean {
    const token = this.getAccessToken();
    return token ? JwtUtils.isStudent(token) : false;
  }

  /**
   * Get refresh token observable for coordinating refreshes
   */
  getRefreshTokenObservable(): Observable<string | null> {
    return this.refreshTokenSubject.asObservable();
  }
}
