import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';


@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private connectivityService: ConnectivityService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
    return this.checkAuthentication(state.url);
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
    return this.canActivate(childRoute, state);
  }

  private checkAuthentication(url: string): Observable<boolean> {
    // ✅ 1. If access token is valid, allow access
    if (this.tokenService.hasValidAccessToken()) {
      return of(true);
    }

    // ✅ 2. If OFFLINE, allow cached user
    if (this.connectivityService.isOffline()) {
      console.log('🌐 Offline mode detected - checking local user...');
      return this.authService.fetchCurrentUser().pipe(
        map(user => {
          if (user) {
            console.log('✅ Offline user found, allowing route access.');
            return true;
          } else {
            console.warn('❌ No offline user found.');
            this.redirectToLogin(url);
            return false;
          }
        }),
        catchError(err => {
          console.error('❌ Offline check failed:', err);
          this.redirectToLogin(url);
          return of(false);
        })
      );
    }

    // ✅ 3. If online and refresh token exists, try refreshing
    if (this.tokenService.getRefreshToken()) {
      return this.authService.refreshTokens().pipe(
        map(() => true),
        catchError(() => {
          this.redirectToLogin(url);
          return of(false);
        })
      );
    }

    // ✅ 4. Otherwise, redirect to login
    this.redirectToLogin(url);
    return of(false);
  }

  private redirectToLogin(returnUrl: string): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl },
      replaceUrl: true
    });
  }
}
