import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../services/token.service';
import {API_ENDPOINTS} from '../../core';

/**
 * Functional HTTP interceptor to attach authentication token
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);

  // Skip token attachment for certain requests
  if (shouldSkipToken(req)) {
    return next(req);
  }

  // Get access token
  const accessToken = tokenService.getAccessToken();

  // If we have a token, attach it to the request
  if (accessToken) {
    const authenticatedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return next(authenticatedRequest);
  }

  // No token available, proceed with original request
  return next(req);
};

/**
 * Determine if token should be skipped for this request
 */
function shouldSkipToken(request: any): boolean {
  const url = request.url;

  // Skip token for external URLs (not our API)
  if (!url.includes(API_ENDPOINTS.BASE_URL)) {
    return true;
  }

  // Skip token for auth endpoints that don't require authentication
  const skipTokenEndpoints = [
    API_ENDPOINTS.AUTH.EMAIL_VERIFY_INITIATE,
    API_ENDPOINTS.AUTH.EMAIL_VERIFY_CONFIRM,
    API_ENDPOINTS.AUTH.EMAIL_VERIFY_RESEND,
    API_ENDPOINTS.AUTH.REGISTER_COMPLETE,
    API_ENDPOINTS.AUTH.LOGIN
  ];

  return skipTokenEndpoints.some(endpoint => url.includes(endpoint));
}
