import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityService {
  private onlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public online$ = this.onlineSubject.asObservable();

  constructor() {
    this.initializeConnectivityMonitoring();
  }

  /**
   * Initialize connectivity monitoring
   */
  private initializeConnectivityMonitoring(): void {
    // Listen to browser online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

    merge(online$, offline$)
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(isOnline => {
        console.log(`🌐 Connectivity changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        this.onlineSubject.next(isOnline);
      });
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.onlineSubject.value;
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return !this.isOnline();
  }

  /**
   * Get online status as observable
   */
  getOnlineStatus(): Observable<boolean> {
    return this.online$;
  }

  /**
   * Wait for connection to be restored
   */
  waitForOnline(): Observable<boolean> {
    if (this.isOnline()) {
      return of(true);
    }

    return this.online$.pipe(
      map(isOnline => isOnline),
      distinctUntilChanged()
    );
  }
}
