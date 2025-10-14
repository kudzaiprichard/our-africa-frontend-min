import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, interval, firstValueFrom } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchMap, startWith } from 'rxjs/operators';
import { HealthCheckService } from '../../../libs/health/health.service';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  private onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private backendHealthySubject = new BehaviorSubject<boolean>(false);
  private lastHealthCheckTime = 0;
  private healthCheckInProgress = false;
  private readonly HEALTH_CHECK_CACHE_MS = 5000; // Cache health check for 5 seconds

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
        startWith(navigator.onLine), // Emit current state immediately
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(isOnline => {
        console.log(`🌐 Network connectivity changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        this.onlineSubject.next(isOnline);

        // Check backend health when network comes online
        if (isOnline) {
          this.checkBackendHealth(true); // Force check, ignore cache
        } else {
          this.backendHealthySubject.next(false);
        }
      });
  }

  /**
   * Initialize periodic backend health checks
   */
  private initializeBackendHealthCheck(): void {
    // Check immediately on startup (with slight delay to let app initialize)
    setTimeout(() => this.checkBackendHealth(true), 1000);

    // Check every 30 seconds
    interval(30000)
      .pipe(
        switchMap(() => this.healthCheckService.isBackendHealthy())
      )
      .subscribe(isHealthy => {
        const wasHealthy = this.backendHealthySubject.value;
        this.backendHealthySubject.next(isHealthy);
        this.lastHealthCheckTime = Date.now();

        if (isHealthy && !wasHealthy) {
          console.log('✅ Backend connection restored');
        } else if (!isHealthy && wasHealthy) {
          console.log('❌ Backend connection lost');
        }
      });
  }

  /**
   * Manually check backend health
   * @param forceCheck - If true, bypass cache and check immediately
   */
  async checkBackendHealth(forceCheck: boolean = false): Promise<boolean> {
    // If not online, don't bother checking
    if (!navigator.onLine) {
      this.backendHealthySubject.next(false);
      return false;
    }

    // Use cached result if recent (unless force check)
    const timeSinceLastCheck = Date.now() - this.lastHealthCheckTime;
    if (!forceCheck && timeSinceLastCheck < this.HEALTH_CHECK_CACHE_MS) {
      console.log(`🏥 Using cached backend health: ${this.backendHealthySubject.value ? 'HEALTHY' : 'UNHEALTHY'}`);
      return this.backendHealthySubject.value;
    }

    // Prevent multiple simultaneous checks
    if (this.healthCheckInProgress) {
      console.log('🏥 Health check already in progress, waiting...');
      return this.backendHealthySubject.value;
    }

    this.healthCheckInProgress = true;

    try {
      const isHealthy = await this.healthCheckService.isBackendHealthy();
      this.backendHealthySubject.next(isHealthy);
      this.lastHealthCheckTime = Date.now();
      console.log(`🏥 Backend health check: ${isHealthy ? 'HEALTHY ✅' : 'UNHEALTHY ❌'}`);
      return isHealthy;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      this.backendHealthySubject.next(false);
      return false;
    } finally {
      this.healthCheckInProgress = false;
    }
  }

  /**
   * SYNCHRONOUS check if currently online
   * Performs a BLOCKING health check if status is stale
   * USE WITH CAUTION - blocks execution until backend responds
   */
  async isOnlineSync(): Promise<boolean> {
    const hasNetwork = this.onlineSubject.value;

    if (!hasNetwork) {
      return false;
    }

    const timeSinceLastCheck = Date.now() - this.lastHealthCheckTime;

    // If status is stale (>5 seconds old), do a fresh synchronous check
    if (timeSinceLastCheck > this.HEALTH_CHECK_CACHE_MS) {
      console.log('🔄 Status is stale, performing synchronous health check...');
      const isHealthy = await this.checkBackendHealth(true);
      return hasNetwork && isHealthy;
    }

    // Otherwise use cached status
    return hasNetwork && this.backendHealthySubject.value;
  }

  /**
   * Check if currently online (non-blocking, uses cached status)
   * For operations that need fresh status, use isOnlineSync() instead
   */
  isOnline(): boolean {
    const hasNetwork = this.onlineSubject.value;
    const backendHealthy = this.backendHealthySubject.value;

    // If we have network but backend status is old, trigger a check in background
    if (hasNetwork && !backendHealthy) {
      const timeSinceLastCheck = Date.now() - this.lastHealthCheckTime;
      if (timeSinceLastCheck > this.HEALTH_CHECK_CACHE_MS) {
        // Trigger async check (don't wait for it)
        this.checkBackendHealth(false).catch(() => {});
      }
    }

    return hasNetwork && backendHealthy;
  }

  /**
   * Check if currently offline (non-blocking)
   */
  isOffline(): boolean {
    return !this.hasNetworkConnection() || !this.backendHealthySubject.value;
  }

  /**
   * SYNCHRONOUS check if currently offline
   * Performs a BLOCKING health check if status is stale
   */
  async isOfflineSync(): Promise<boolean> {
    return !(await this.isOnlineSync());
  }

  /**
   * Check if network is connected (regardless of backend health)
   */
  hasNetworkConnection(): boolean {
    return this.onlineSubject.value;
  }

  /**
   * Check if backend is reachable (uses cached status)
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
      map(isHealthy => isHealthy && this.hasNetworkConnection()),
      distinctUntilChanged()
    );
  }

  /**
   * Force refresh backend health status (synchronous)
   * Useful after successful API calls (like login)
   */
  async refreshBackendHealth(): Promise<boolean> {
    console.log('🔄 Force refreshing backend health...');
    return this.checkBackendHealth(true);
  }
}
