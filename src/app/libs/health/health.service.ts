import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_ENDPOINTS, BaseHttpService } from '../core';

export interface HealthCheckResponse {
  status: 0 | 1;
  is_healthy: boolean;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {

  constructor(private baseHttp: BaseHttpService) {}

  /**
   * Check backend health
   * @returns Observable with health check response
   */
  checkHealth(): Observable<HealthCheckResponse> {
    return this.baseHttp.get<HealthCheckResponse>(API_ENDPOINTS.HEALTH).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Check if backend is healthy (simple boolean check)
   * @returns Promise that resolves to true if healthy, false otherwise
   */
  async isBackendHealthy(): Promise<boolean> {
    try {
      const result = await new Promise<HealthCheckResponse>((resolve, reject) => {
        this.checkHealth().subscribe({
          next: (response) => resolve(response),
          error: (error) => reject(error)
        });
      });
      return result?.is_healthy ?? false;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }
}
