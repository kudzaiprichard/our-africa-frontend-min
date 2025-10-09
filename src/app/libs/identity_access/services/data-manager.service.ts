import { Injectable } from '@angular/core';
import { CurrentUser } from '../models/auth-state.interface';
import {StorageService} from '../../core';

/**
 * Dedicated service for managing user data persistence
 * Breaks circular dependency between AuthService and UserService
 */
@Injectable({
  providedIn: 'root'
})
export class UserDataManager {

  constructor(private storageService: StorageService) {}

  /**
   * Save user data to persistent storage
   */
  saveUserData(userData: CurrentUser): void {
    try {
      this.storageService.setUserData(userData);
      console.log('User data saved to storage');
    } catch (error) {
      console.error('Failed to save user data to storage:', error);
    }
  }

  /**
   * Restore user data from persistent storage
   */
  restoreUserData(): CurrentUser | null {
    try {
      const userData = this.storageService.getUserData<CurrentUser>();
      if (userData) {
        console.log('User data restored from storage');
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Failed to restore user data from storage:', error);
      return null;
    }
  }

  /**
   * Clear user data from persistent storage
   */
  clearUserData(): void {
    try {
      this.storageService.clearAll();
      console.log('User data cleared from storage');
    } catch (error) {
      console.error('Failed to clear user data from storage:', error);
    }
  }

  /**
   * Check if user data exists in storage
   */
  hasUserData(): boolean {
    try {
      const userData = this.storageService.getUserData();
      return userData !== null;
    } catch (error) {
      console.error('Failed to check user data in storage:', error);
      return false;
    }
  }

  /**
   * Update specific user data fields in storage
   */
  updateUserData(updates: Partial<CurrentUser>): void {
    try {
      const existingData = this.restoreUserData();
      if (existingData) {
        const updatedData = { ...existingData, ...updates };
        this.saveUserData(updatedData);
        console.log('User data updated in storage');
      }
    } catch (error) {
      console.error('Failed to update user data in storage:', error);
    }
  }
}
