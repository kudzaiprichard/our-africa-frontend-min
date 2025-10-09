import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ApiResponse } from '../models/api-response.interface';
import { ErrorDetail } from '../models/error-detail.interface';
import { API_ENDPOINTS } from '../constants/api-endpoints';

/**
 * Functional HTTP interceptor to handle ApiResponse wrapper
 */
export const responseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        return handleSuccessResponse(event, req);
      }
      return event;
    }),
    catchError((error: HttpErrorResponse) => {
      return handleErrorResponse(error, req);
    })
  );
};

/**
 * Handle successful HTTP responses
 */
function handleSuccessResponse(response: HttpResponse<any>, request: any): HttpResponse<any> {
  if (!isApiRequest(request)) {
    return response;
  }

  const body = response.body;

  // If response is already in ApiResponse format, return as is
  if (isApiResponse(body)) {
    return response;
  }

  // Wrap plain response in ApiResponse format
  const wrappedResponse: ApiResponse<any> = {
    message: 'Success',
    value: body
  };

  return response.clone({
    body: wrappedResponse
  });
}

/**
 * Handle HTTP error responses
 */
function handleErrorResponse(error: HttpErrorResponse, request: any) {
  if (!isApiRequest(request)) {
    return throwError(() => error);
  }

  let errorDetail: ErrorDetail;

  // If error response has ApiResponse format with ErrorDetail
  if (error.error && isApiResponseWithError(error.error)) {
    errorDetail = error.error.error;
  }
  // If error response has ErrorDetail directly
  else if (error.error && isErrorDetail(error.error)) {
    errorDetail = error.error;
  }
  // If error response has some error structure
  else if (error.error && typeof error.error === 'object') {
    errorDetail = createErrorDetailFromObject(error.error, error.status);
  }
  // Generic network/unknown error
  else {
    errorDetail = createGenericErrorDetail(error);
  }

  // Create standardized error response
  const apiErrorResponse: ApiResponse<null> = {
    error: errorDetail,
    message: errorDetail.title
  };

  // Create new error with standardized format
  const standardizedError = new HttpErrorResponse({
    error: apiErrorResponse,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText || '',
    url: error.url || undefined
  });

  return throwError(() => standardizedError);
}

/**
 * Check if request is to our API
 */
function isApiRequest(request: any): boolean {
  return request.url.includes(API_ENDPOINTS.BASE_URL);
}

/**
 * Check if response body is already in ApiResponse format
 */
function isApiResponse(body: any): body is ApiResponse<any> {
  return body &&
    typeof body === 'object' &&
    ('error' in body || 'message' in body || 'value' in body);
}

/**
 * Check if error response is ApiResponse with ErrorDetail
 */
function isApiResponseWithError(errorResponse: any): boolean {
  return isApiResponse(errorResponse) &&
    errorResponse.error !== null &&
    errorResponse.error !== undefined &&
    isErrorDetail(errorResponse.error);
}

/**
 * Check if object is ErrorDetail
 */
function isErrorDetail(obj: any): obj is ErrorDetail {
  return obj &&
    typeof obj === 'object' &&
    'title' in obj &&
    'status' in obj &&
    (('details' in obj && Array.isArray(obj.details)) ||
      ('field_errors' in obj && typeof obj.field_errors === 'object'));
}

/**
 * Create ErrorDetail from generic error object
 */
function createErrorDetailFromObject(errorObj: any, status: number): ErrorDetail {
  const errorDetail: ErrorDetail = {
    title: errorObj.title || errorObj.message || getStatusText(status),
    status: status || 500
  };

  // Add details if present
  if (errorObj.details && Array.isArray(errorObj.details)) {
    errorDetail.details = errorObj.details;
  }

  // Add field_errors if present
  if (errorObj.field_errors && typeof errorObj.field_errors === 'object') {
    errorDetail.field_errors = errorObj.field_errors;
  }

  // Fallback to extracting details
  if (!errorDetail.details && !errorDetail.field_errors) {
    errorDetail.details = extractErrorDetails(errorObj);
  }

  return errorDetail;
}

/**
 * Create ErrorDetail for generic/network errors
 */
function createGenericErrorDetail(error: HttpErrorResponse): ErrorDetail {
  return {
    title: getStatusText(error.status),
    details: [error.message || 'An unexpected error occurred'],
    status: error.status || 0
  };
}

/**
 * Extract error details from error object
 */
function extractErrorDetails(errorObj: any): string[] {
  if (errorObj.details && Array.isArray(errorObj.details)) {
    return errorObj.details;
  }

  if (errorObj.message) {
    return [errorObj.message];
  }

  if (errorObj.errors && Array.isArray(errorObj.errors)) {
    return errorObj.errors.map((err: any) => typeof err === 'string' ? err : err.message || 'Validation error');
  }

  if (errorObj.error && typeof errorObj.error === 'string') {
    return [errorObj.error];
  }

  return ['An error occurred'];
}

/**
 * Get user-friendly status text
 */
function getStatusText(status: number): string {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 409: return 'Conflict';
    case 422: return 'Validation Failed';
    case 429: return 'Too Many Requests';
    case 500: return 'Server Error';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    case 504: return 'Gateway Timeout';
    case 0: return 'Network Error';
    default: return 'Request Failed';
  }
}
