/**
 * authentication.dtos.interface.ts
 * Matches backend authentication DTOs
 */

// ============ Token Info DTO ============

export interface TokenInfo {
  token: string;
  token_type: string;
  expires_at: string;
  created_at: string;
}

// ============ Email Verification Flow ============

export interface InitiateEmailVerificationRequest {
  email: string;
  purpose: string; // 'registration' or 'email_change'
}

export interface InitiateEmailVerificationResponse {
  message: string;
  expires_in_minutes: number;
}

export interface VerifyEmailCodeRequest {
  email: string;
  code: string;
  purpose: string; // 'registration' or 'email_change'
}

export interface VerifyEmailCodeResponse {
  message: string;
  temp_token?: string; // Only for registration
  expires_in_minutes?: number;
}

export interface ResendEmailCodeRequest {
  email: string;
  purpose: string; // 'registration' or 'email_change'
}

// ============ Complete Registration ============

export interface CompleteRegistrationRequest {
  temp_token: string;
  first_name: string;
  last_name: string;
  password: string;
  middle_name?: string;
  bio?: string;
  phone_number?: string;
}

export interface CompleteRegistrationResponse {
  message: string;
  user: any;
  access_token?: TokenInfo;
  refresh_token?: TokenInfo;
}

// ============ Login Feature ============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: any;
  access_token?: TokenInfo;
  refresh_token?: TokenInfo;
}

// ============ Logout Feature ============

export interface LogoutRequest {
  token: string;
}

export interface LogoutResponse {
  message: string;
}

// ============ Refresh Token Feature ============

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  message: string;
  access_token: TokenInfo;
  refresh_token: TokenInfo;
}

// ============ Email Change Flow (Protected) ============

export interface InitiateEmailChangeRequest {
  user_id: string;
  new_email: string;
}

export interface InitiateEmailChangeResponse {
  message: string;
  expires_in_minutes: number;
}

export interface CompleteEmailChangeRequest {
  user_id: string;
  code: string;
}

export interface CompleteEmailChangeResponse {
  message: string;
}

// ============ Password Reset Feature (Future Implementation) ============

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
}
