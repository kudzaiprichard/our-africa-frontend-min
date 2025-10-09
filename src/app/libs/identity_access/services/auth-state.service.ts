import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthState, LoginState, RegisterState } from '../models/auth-state.interface';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import {UserService} from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {

  // Core auth state signals
  private isAuthenticatedSignal = signal<boolean>(false);
  private isLoadingSignal = signal<boolean>(false);
  private isRefreshingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Login state signals
  private isLoggingInSignal = signal<boolean>(false);
  private loginErrorSignal = signal<string | null>(null);
  private rememberMeSignal = signal<boolean>(false);

  // Registration state signals
  private isRegisteringSignal = signal<boolean>(false);
  private registerErrorSignal = signal<string | null>(null);
  private registerStepSignal = signal<'email-verification' | 'complete-registration'>('email-verification');
  private tempTokenSignal = signal<string | null>(null);
  private verifiedEmailSignal = signal<string | null>(null);

  // RxJS subjects for compatibility
  private authStateSubject = new BehaviorSubject<AuthState>(this.getInitialAuthState());

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private tokenService: TokenService
  ) {
    this.initializeState();
  }

  // ========== COMPUTED STATE ==========

  /**
   * Complete auth state (computed from signals)
   */
  authState = computed<AuthState>(() => ({
    isAuthenticated: this.isAuthenticatedSignal(),
    isLoading: this.isLoadingSignal(),
    isRefreshing: this.isRefreshingSignal(),
    user: this.userService.getCurrentUserValue(),
    accessToken: this.tokenService.getAccessToken(),
    refreshToken: this.tokenService.getRefreshToken(),
    tokenExpiresAt: this.getTokenExpirationDate(),
    error: this.errorSignal(),
    lastLoginAttempt: null
  }));

  /**
   * Login state (computed)
   */
  loginState = computed<LoginState>(() => ({
    isLoggingIn: this.isLoggingInSignal(),
    loginError: this.loginErrorSignal(),
    rememberMe: this.rememberMeSignal()
  }));

  /**
   * Registration state (computed)
   */
  registerState = computed<RegisterState>(() => ({
    isRegistering: this.isRegisteringSignal(),
    registerError: this.registerErrorSignal(),
    step: this.registerStepSignal(),
    tempToken: this.tempTokenSignal(),
    verifiedEmail: this.verifiedEmailSignal()
  }));

  /**
   * Overall loading state
   */
  isLoading = computed(() =>
    this.isLoadingSignal() ||
    this.isLoggingInSignal() ||
    this.isRegisteringSignal() ||
    this.isRefreshingSignal()
  );

  /**
   * Has any error
   */
  hasError = computed(() =>
    this.errorSignal() !== null ||
    this.loginErrorSignal() !== null ||
    this.registerErrorSignal() !== null
  );

  /**
   * Current error message
   */
  currentError = computed(() =>
    this.errorSignal() ||
    this.loginErrorSignal() ||
    this.registerErrorSignal()
  );

  // ========== STATE UPDATES ==========

  /**
   * Set authentication status
   */
  setAuthenticated(isAuthenticated: boolean): void {
    this.isAuthenticatedSignal.set(isAuthenticated);
    this.updateAuthStateSubject();
  }

  /**
   * Set loading status
   */
  setLoading(isLoading: boolean): void {
    this.isLoadingSignal.set(isLoading);
    this.updateAuthStateSubject();
  }

  /**
   * Set refreshing status
   */
  setRefreshing(isRefreshing: boolean): void {
    this.isRefreshingSignal.set(isRefreshing);
    this.updateAuthStateSubject();
  }

  /**
   * Set error
   */
  setError(error: string | null): void {
    this.errorSignal.set(error);
    this.updateAuthStateSubject();
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errorSignal.set(null);
    this.loginErrorSignal.set(null);
    this.registerErrorSignal.set(null);
  }

  // ========== LOGIN STATE ==========

  /**
   * Set login loading status
   */
  setLoggingIn(isLoggingIn: boolean): void {
    this.isLoggingInSignal.set(isLoggingIn);
  }

  /**
   * Set login error
   */
  setLoginError(error: string | null): void {
    this.loginErrorSignal.set(error);
  }

  /**
   * Set remember me preference
   */
  setRememberMe(rememberMe: boolean): void {
    this.rememberMeSignal.set(rememberMe);
  }

  /**
   * Clear login state
   */
  clearLoginState(): void {
    this.isLoggingInSignal.set(false);
    this.loginErrorSignal.set(null);
  }

  // ========== REGISTRATION STATE ==========

  /**
   * Set registration loading status
   */
  setRegistering(isRegistering: boolean): void {
    this.isRegisteringSignal.set(isRegistering);
  }

  /**
   * Set registration error
   */
  setRegisterError(error: string | null): void {
    this.registerErrorSignal.set(error);
  }

  /**
   * Set registration step
   */
  setRegisterStep(step: 'email-verification' | 'complete-registration'): void {
    this.registerStepSignal.set(step);
  }

  /**
   * Set temporary token after email verification
   */
  setTempToken(token: string | null): void {
    this.tempTokenSignal.set(token);
  }

  /**
   * Set verified email
   */
  setVerifiedEmail(email: string | null): void {
    this.verifiedEmailSignal.set(email);
  }

  /**
   * Clear registration state
   */
  clearRegisterState(): void {
    this.isRegisteringSignal.set(false);
    this.registerErrorSignal.set(null);
    this.registerStepSignal.set('email-verification');
    this.tempTokenSignal.set(null);
    this.verifiedEmailSignal.set(null);
  }

  // ========== OBSERVABLES (for RxJS compatibility) ==========

  /**
   * Get auth state observable
   */
  getAuthState$(): Observable<AuthState> {
    return this.authStateSubject.asObservable();
  }

  /**
   * Get combined auth and user state observable
   */
  getCombinedState$(): Observable<{auth: AuthState, user: any}> {
    return combineLatest([
      this.authStateSubject,
      this.userService.getCurrentUser$()
    ]).pipe(
      map(([authState, user]) => ({ auth: authState, user }))
    );
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Initialize state from existing tokens/services
   */
  private initializeState(): void {
    // Initialize authentication status
    const hasValidTokens = this.tokenService.hasValidTokens();
    this.setAuthenticated(hasValidTokens);

    // Subscribe to auth services state changes
    this.authService.isAuthenticated$().subscribe(isAuth => {
      this.setAuthenticated(isAuth);
    });

    this.authService.isLoading$().subscribe(isLoading => {
      this.setLoading(isLoading);
    });
  }

  /**
   * Get initial auth state
   */
  private getInitialAuthState(): AuthState {
    return {
      isAuthenticated: false,
      isLoading: false,
      isRefreshing: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      error: null,
      lastLoginAttempt: null
    };
  }

  /**
   * Update RxJS subject with current state
   */
  private updateAuthStateSubject(): void {
    this.authStateSubject.next(this.authState());
  }

  /**
   * Get token expiration date
   */
  private getTokenExpirationDate(): Date | null {
    const token = this.tokenService.getAccessToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  // ========== UTILITY METHODS ==========

  /**
   * Reset all state (for logout)
   */
  resetState(): void {
    this.setAuthenticated(false);
    this.setLoading(false);
    this.setRefreshing(false);
    this.clearErrors();
    this.clearLoginState();
    this.clearRegisterState();
    this.updateAuthStateSubject();
  }

  /**
   * Handle successful authentication
   */
  handleAuthSuccess(): void {
    this.setAuthenticated(true);
    this.clearErrors();
    this.clearLoginState();
    this.clearRegisterState();
  }

  /**
   * Handle authentication failure
   */
  handleAuthFailure(error: string): void {
    this.setAuthenticated(false);
    this.setError(error);
    this.setLoading(false);
    this.setRefreshing(false);
  }
}
