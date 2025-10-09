import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private router: Router
  ) {}

  /**
   * Check if route can be activated based on user role
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.checkRoleAccess(route, state.url);
  }

  /**
   * Check if child routes can be activated based on user role
   */
  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.canActivate(childRoute, state);
  }

  /**
   * Check role-based access
   */
  private checkRoleAccess(route: ActivatedRouteSnapshot, url: string): Observable<boolean> {
    // First ensure user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.redirectToLogin(url);
      return of(false);
    }

    // Get role requirements from route data
    const requiredRoles = route.data['roles'] as string[];

    // If no role requirements specified, allow access (just need to be authenticated)
    if (!requiredRoles || requiredRoles.length === 0) {
      return of(true);
    }

    // Get current user role from token
    const currentUserRole = this.tokenService.getCurrentUserRole();

    if (!currentUserRole) {
      this.redirectToLogin(url);
      return of(false);
    }

    // Check if user has required role
    const hasRequiredRole = requiredRoles.includes(currentUserRole);

    if (!hasRequiredRole) {
      this.redirectToUnauthorized();
      return of(false);
    }

    return of(true);
  }

  /**
   * Redirect to login page
   */
  private redirectToLogin(returnUrl: string): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl },
      replaceUrl: true
    });
  }

  /**
   * Redirect to unauthorized page
   */
  private redirectToUnauthorized(): void {
    this.router.navigate(['/unauthorized'], {
      replaceUrl: true
    });
  }
}

/**
 * Helper function to create role-based route data
 */
export function requireRoles(roles: string[]): { roles: string[] } {
  return { roles };
}

/**
 * Common role combinations
 */
export const ADMIN_ONLY = requireRoles(['admin']);
export const STUDENT_ONLY = requireRoles(['student']);
export const ADMIN_OR_STUDENT = requireRoles(['admin', 'student']);
