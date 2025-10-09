import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private router: Router
  ) {}

  /**
   * Check if route can be activated (user is authenticated)
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.checkAuthentication(state.url);
  }

  /**
   * Check if child routes can be activated
   */
  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.canActivate(childRoute, state);
  }

  /**
   * Check authentication status
   */
  private checkAuthentication(url: string): Observable<boolean> {
    // First check if we have valid tokens locally
    if (this.tokenService.hasValidAccessToken()) {
      return of(true);
    }

    // If access token is expired but we have a refresh token, try to refresh
    if (this.tokenService.getRefreshToken() && !this.tokenService.hasValidAccessToken()) {
      return this.authService.refreshTokens().pipe(
        map(() => {
          // Refresh successful, allow access
          return true;
        }),
        catchError(() => {
          // Refresh failed, redirect to login
          this.redirectToLogin(url);
          return of(false);
        })
      );
    }

    // No valid tokens, redirect to login
    this.redirectToLogin(url);
    return of(false);
  }

  /**
   * Redirect to login page with return URL
   */
  private redirectToLogin(returnUrl: string): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl },
      replaceUrl: true
    });
  }
}
