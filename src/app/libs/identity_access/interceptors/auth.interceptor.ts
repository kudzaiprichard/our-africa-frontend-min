import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, BehaviorSubject, Observable } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import {API_ENDPOINTS} from '../../core';

// Global state for token refresh coordination
let isRefreshing = false;
const refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

/**
 * Functional HTTP interceptor to handle token refresh on 401 errors
 */
export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle 401 errors (Unauthorized)
      if (error.status === 401) {
        return handle401Error(req, next, tokenService, authService);
      }

      // For other errors, just pass them through
      return throwError(() => error);
    })
  );
};

/**
 * Handle 401 Unauthorized errors with token refresh
 */
function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  tokenService: TokenService,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  // Skip refresh for certain endpoints
  if (shouldSkipRefresh(request)) {
    return throwError(() => new HttpErrorResponse({ status: 401 }));
  }

  // If we're not currently refreshing and we have a refresh token
  if (!isRefreshing && tokenService.getRefreshToken()) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return tokenService.refreshAccessToken().pipe(
      switchMap((refreshResponse) => {
        isRefreshing = false;
        const newAccessToken = refreshResponse.access_token.token;
        refreshTokenSubject.next(newAccessToken);

        // Retry the original request with the new token
        return next(addTokenToRequest(request, newAccessToken));
      }),
      catchError((refreshError) => {
        isRefreshing = false;

        // Refresh failed, logout user
        authService.logout().subscribe();

        return throwError(() => refreshError);
      })
    );
  }
  // If we're already refreshing, wait for it to complete
  else if (isRefreshing) {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => {
        // Retry the original request with the refreshed token
        return next(addTokenToRequest(request, token));
      })
    );
  }

  // No refresh token available, let the error pass through
  return throwError(() => new HttpErrorResponse({ status: 401 }));
}

/**
 * Add authorization token to request
 */
function addTokenToRequest(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

/**
 * Determine if token refresh should be skipped for this request
 */
function shouldSkipRefresh(request: HttpRequest<unknown>): boolean {
  const url = request.url;

  // Skip refresh for external URLs
  if (!url.includes(API_ENDPOINTS.BASE_URL)) {
    return true;
  }

  // Skip refresh for auth-related endpoints
  const skipRefreshEndpoints = [
    API_ENDPOINTS.AUTH.EMAIL_VERIFY_INITIATE,
    API_ENDPOINTS.AUTH.EMAIL_VERIFY_CONFIRM,
    API_ENDPOINTS.AUTH.EMAIL_VERIFY_RESEND,
    API_ENDPOINTS.AUTH.REGISTER_COMPLETE,
    API_ENDPOINTS.AUTH.LOGIN,
    API_ENDPOINTS.AUTH.REFRESH_TOKEN,
    API_ENDPOINTS.AUTH.LOGOUT
  ];

  return skipRefreshEndpoints.some(endpoint => url.includes(endpoint));
}
