import {environment} from '../../../environments/environment';

/**
 * API endpoints that match backend controller mappings
 */
export const API_ENDPOINTS = {
  BASE_URL: environment.apiUrl,

  // Auth endpoints - matches identity_api_bp Blueprint
  AUTH: {
    BASE: '/api/auth',

    // Email Verification endpoints
    EMAIL_VERIFY_INITIATE: '/api/auth/email/verify/initiate',
    EMAIL_VERIFY_CONFIRM: '/api/auth/email/verify/confirm',
    EMAIL_VERIFY_RESEND: '/api/auth/email/verify/resend',

    // Registration endpoints
    REGISTER_COMPLETE: '/api/auth/register/complete',

    // Authentication endpoints
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH_TOKEN: '/api/auth/refresh-token',

    // Email Change endpoints (Protected)
    EMAIL_CHANGE_INITIATE: '/api/auth/email/change/initiate',
    EMAIL_CHANGE_CONFIRM: '/api/auth/email/change/confirm',

    // User Profile endpoints (Protected)
    PROFILE: '/api/auth/profile',
    CHANGE_PASSWORD: '/api/auth/change-password',
    DEACTIVATE_ACCOUNT: '/api/auth/deactivate'
  }
} as const;
