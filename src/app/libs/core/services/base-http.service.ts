import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiResponse } from '../models/api-response.interface';
import { ErrorDetail } from '../models/error-detail.interface';
import { API_ENDPOINTS } from '../constants/api-endpoints';

@Injectable({
  providedIn: 'root'
})
export class BaseHttpService {

  private readonly baseUrl = API_ENDPOINTS.BASE_URL;

  constructor(private http: HttpClient) {}

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: HttpParams): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, {
      params,
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${endpoint}`, body, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Download file (PDF, images, etc.)
   * Returns Blob for file downloads like certificates
   */
  downloadFile(endpoint: string, params?: HttpParams): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${endpoint}`, {
      params,
      headers: this.getDownloadHeaders(),
      responseType: 'blob', // Important: tells Angular to expect binary data
      observe: 'body'
    }).pipe(
      catchError(this.handleFileDownloadError)
    );
  }

  /**
   * Get common headers
   */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  /**
   * Get headers for file downloads
   * Note: Don't set Content-Type for downloads, let browser handle it
   */
  private getDownloadHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/pdf, application/octet-stream'
    });
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorDetail: ErrorDetail;

    if (error.error && error.error.error) {
      // Backend returned an ApiResponse with error
      errorDetail = error.error.error;
    } else if (error.error && typeof error.error === 'object') {
      // Backend returned some error object
      errorDetail = {
        title: error.error.message || 'An error occurred',
        details: error.error.details || [error.message],
        status: error.status
      };
    } else {
      // Network or unknown error
      errorDetail = {
        title: this.getErrorTitle(error.status),
        details: [error.message || 'Unknown error occurred'],
        status: error.status
      };
    }

    console.error('HTTP Error:', errorDetail);
    return throwError(() => errorDetail);
  };

  /**
   * Handle file download errors
   * File download errors need special handling because the error might be a Blob
   */
  private handleFileDownloadError = (error: HttpErrorResponse): Observable<never> => {
    // If error.error is a Blob, it means the backend returned JSON error as blob
    if (error.error instanceof Blob && error.error.type === 'application/json') {
      // Convert Blob to JSON to read the error message
      return new Observable(observer => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorJson = JSON.parse(reader.result as string);
            const errorDetail: ErrorDetail = errorJson.error || {
              title: 'Download Failed',
              details: [errorJson.message || 'Failed to download file'],
              status: error.status
            };
            console.error('File Download Error:', errorDetail);
            observer.error(errorDetail);
          } catch (e) {
            // Failed to parse error JSON
            const errorDetail: ErrorDetail = {
              title: 'Download Failed',
              details: ['An error occurred while downloading the file'],
              status: error.status
            };
            console.error('File Download Error:', errorDetail);
            observer.error(errorDetail);
          }
        };
        reader.onerror = () => {
          const errorDetail: ErrorDetail = {
            title: 'Download Failed',
            details: ['Failed to read error response'],
            status: error.status
          };
          console.error('File Download Error:', errorDetail);
          observer.error(errorDetail);
        };
        reader.readAsText(error.error);
      });
    } else {
      // Regular error handling
      return this.handleError(error);
    }
  };

  /**
   * Get user-friendly error title based on status code
   */
  private getErrorTitle(status: number): string {
    switch (status) {
      case 400:
        return 'Invalid Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Access Denied';
      case 404:
        return 'Not Found';
      case 409:
        return 'Conflict';
      case 422:
        return 'Validation Error';
      case 500:
        return 'Server Error';
      case 503:
        return 'Service Unavailable';
      case 0:
        return 'Network Error';
      default:
        return 'Request Failed';
    }
  }

}
