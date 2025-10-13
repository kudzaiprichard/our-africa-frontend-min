import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, interval } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {HealthCheckService} from '../../../libs/health/health.service';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  private onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private backendHealthySubject = new BehaviorSubject<boolean>(false);

  public online$ = this.onlineSubject.asObservable();
  public backendHealthy$ = this.backendHealthySubject.asObservable();

  constructor(private healthCheckService: HealthCheckService) {
    this.initializeConnectivityMonitoring();
    this.initializeBackendHealthCheck();
  }

  /**
   * Initialize connectivity monitoring (browser network state)
   */
  private initializeConnectivityMonitoring(): void {
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

    merge(online$, offline$)
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(isOnline => {
        console.log(`🌐 Network connectivity changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        this.onlineSubject.next(isOnline);

        // Check backend health when network comes online
        if (isOnline) {
          this.checkBackendHealth();
        } else {
          this.backendHealthySubject.next(false);
        }
      });
  }

  /**
   * Initialize periodic backend health checks
   */
  private initializeBackendHealthCheck(): void {
    // Check immediately on startup
    this.checkBackendHealth();

    // Check every 30 seconds
    interval(30000)
      .pipe(
        switchMap(() => this.healthCheckService.isBackendHealthy())
      )
      .subscribe(isHealthy => {
        const wasHealthy = this.backendHealthySubject.value;
        this.backendHealthySubject.next(isHealthy);

        if (isHealthy && !wasHealthy) {
          console.log('✅ Backend connection restored');
        } else if (!isHealthy && wasHealthy) {
          console.log('❌ Backend connection lost');
        }
      });
  }

  /**
   * Manually check backend health
   */
  async checkBackendHealth(): Promise<void> {
    if (!navigator.onLine) {
      this.backendHealthySubject.next(false);
      return;
    }

    const isHealthy = await this.healthCheckService.isBackendHealthy();
    this.backendHealthySubject.next(isHealthy);
    console.log(`🏥 Backend health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  }

  /**
   * Check if currently online (network + backend)
   */
  isOnline(): boolean {
    return this.onlineSubject.value && this.backendHealthySubject.value;
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return !this.isOnline();
  }

  /**
   * Check if network is connected (regardless of backend health)
   */
  hasNetworkConnection(): boolean {
    return this.onlineSubject.value;
  }

  /**
   * Check if backend is reachable
   */
  isBackendHealthy(): boolean {
    return this.backendHealthySubject.value;
  }

  /**
   * Get online status as observable (network + backend)
   */
  getOnlineStatus(): Observable<boolean> {
    return this.backendHealthy$;
  }

  /**
   * Wait for connection to be restored
   */
  waitForOnline(): Observable<boolean> {
    if (this.isOnline()) {
      return new Observable(observer => {
        observer.next(true);
        observer.complete();
      });
    }

    return this.backendHealthy$.pipe(
      map(isHealthy => isHealthy),
      distinctUntilChanged()
    );
  }
}
