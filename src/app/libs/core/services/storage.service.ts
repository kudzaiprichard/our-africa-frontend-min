import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { JwtUtils } from '../utils/jwt.utils';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  /**
   * Store access token
   */
  setAccessToken(token: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error('Error storing access token:', error);
    }
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  }

  /**
   * Store refresh token
   */
  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  }

  /**
   * Store temporary token (after email verification)
   */
  setTempToken(token: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMP_TOKEN, token);
    } catch (error) {
      console.error('Error storing temp token:', error);
    }
  }

  /**
   * Get temporary token
   */
  getTempToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.TEMP_TOKEN);
    } catch (error) {
      console.error('Error retrieving temp token:', error);
      return null;
    }
  }

  /**
   * Clear temporary token
   */
  clearTempToken(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.TEMP_TOKEN);
    } catch (error) {
      console.error('Error clearing temp token:', error);
    }
  }

  /**
   * Store user data
   */
  setUserData(userData: any): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  }

  /**
   * Get user data
   */
  getUserData<T = any>(): T | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving user data:', error);
      return null;
    }
  }

  /**
   * Clear all stored data (logout)
   */
  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      localStorage.removeItem(STORAGE_KEYS.TEMP_TOKEN);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Check if user has valid tokens
   */
  hasValidTokens(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    if (!accessToken || !refreshToken) {
      return false;
    }

    if (JwtUtils.isTokenExpired(accessToken)) {
      return !JwtUtils.isTokenExpired(refreshToken);
    }

    return true;
  }

  /**
   * Check if access token is valid (not expired)
   */
  hasValidAccessToken(): boolean {
    const accessToken = this.getAccessToken();
    if (!accessToken) return false;

    return !JwtUtils.isTokenExpired(accessToken);
  }

  /**
   * Check if access token will expire soon
   */
  accessTokenExpiresSoon(minutesThreshold = 5): boolean {
    const accessToken = this.getAccessToken();
    if (!accessToken) return true;

    return JwtUtils.willExpireSoon(accessToken, minutesThreshold);
  }

  /**
   * Store both tokens at once (after successful login/refresh)
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  }
}
