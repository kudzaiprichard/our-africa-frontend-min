/**
 * user-management.dtos.interface.ts
 * Matches backend user management DTOs
 */

// ============ Get User Profile Feature ============

export interface GetUserProfileRequest {
  user_id: string;
}

export interface GetUserProfileResponse {
  user: any;
}

// ============ Update User Profile Feature ============

export interface UpdateUserProfileRequest {
  user_id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  bio?: string;
  phone_number?: string;
}

export interface UpdateUserProfileResponse {
  message: string;
  user: any;
}

// ============ Change Password Feature ============

export interface ChangePasswordRequest {
  user_id: string;
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message: string;
}

// ============ Deactivate Account Feature ============

export interface DeactivateAccountRequest {
  user_id: string;
  password: string;
}

export interface DeactivateAccountResponse {
  message: string;
}

// ============ Get User by ID (Admin) Feature ============

export interface GetUserByIdRequest {
  user_id: string;
  admin_id: string;
}

export interface GetUserByIdResponse {
  user: any;
}

// ============ Get All Users (Admin) Feature ============

export interface GetAllUsersRequest {
  admin_id: string;
  page?: number;
  per_page?: number;
}

export interface GetAllUsersResponse {
  users: any[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============ Update User Role (Admin) Feature ============

export interface UpdateUserRoleRequest {
  user_id: string;
  admin_id: string;
  new_role: string; // 'student' or 'admin'
}

export interface UpdateUserRoleResponse {
  message: string;
  user: any;
}

// ============ Activate/Deactivate User (Admin) Feature ============

export interface ToggleUserStatusRequest {
  user_id: string;
  admin_id: string;
  is_active: boolean;
}

export interface ToggleUserStatusResponse {
  message: string;
  user: any;
}

// ============ Delete User (Admin) Feature ============

export interface DeleteUserRequest {
  user_id: string;
  admin_id: string;
}

export interface DeleteUserResponse {
  message: string;
}
