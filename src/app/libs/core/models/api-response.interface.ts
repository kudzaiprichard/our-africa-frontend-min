import { ErrorDetail } from './error-detail.interface';

/**
 * Standard API Response wrapper that matches backend ApiResponse<T>
 */
export interface ApiResponse<T> {
  error?: ErrorDetail;
  message?: string;
  value?: T;
}
