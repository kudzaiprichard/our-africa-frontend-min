/**
 * Authentication state for frontend state management
 */
export interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;

  // User information
  user: CurrentUser | null;

  // Token information
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;

  // Error state
  error: string | null;
  lastLoginAttempt: Date | null;
}

/**
 * Simplified current user interface for UI components
 */
export interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  role: 'student' | 'admin';
  bio?: string;
  phone_number?: string;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

/**
 * Login state for forms
 */
export interface LoginState {
  isLoggingIn: boolean;
  loginError: string | null;
  rememberMe: boolean;
}

/**
 * Registration state for forms
 */
export interface RegisterState {
  isRegistering: boolean;
  registerError: string | null;
  step: 'email-verification' | 'complete-registration';
  tempToken: string | null;
  verifiedEmail: string | null;
}
