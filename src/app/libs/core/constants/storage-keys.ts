/**
 * Storage keys for localStorage/sessionStorage
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'our-africa-access-token',
  REFRESH_TOKEN: 'our-africa-refresh-token',
  USER_DATA: 'our-africa-user-data',
  TEMP_TOKEN: 'our-africa-temp-token' // For registration flow after email verification
} as const;
