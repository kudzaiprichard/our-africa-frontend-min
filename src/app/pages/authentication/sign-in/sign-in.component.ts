import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../libs/identity_access/services/auth.service';
import { AuthStateService } from '../../../libs/identity_access/services/auth-state.service';
import { LoginRequest } from '../../../libs/identity_access/models/authentication.dtos.interface';
import { ToastsService, ToastType } from '../../../theme/shared';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;
  isLoading: boolean = false;

  // Validation error states
  emailError: boolean = false;
  passwordError: boolean = false;

  constructor(
    private authService: AuthService,
    private authStateService: AuthStateService,
    private router: Router,
    private toastsService: ToastsService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    // Reset errors
    this.emailError = false;
    this.passwordError = false;

    // Field-specific validation
    if (!this.email && !this.password) {
      this.emailError = true;
      this.passwordError = true;
      this.toastsService.showToastAdvanced({
        title: 'Validation Error',
        message: 'Please enter your email and password',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.email) {
      this.emailError = true;
      this.toastsService.showToastAdvanced({
        title: 'Email Required',
        message: 'Please enter your email address',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.password) {
      this.passwordError = true;
      this.toastsService.showToastAdvanced({
        title: 'Password Required',
        message: 'Please enter your password',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    this.isLoading = true;
    this.authStateService.setLoggingIn(true);
    this.authStateService.setRememberMe(this.rememberMe);

    const loginRequest: LoginRequest = {
      email: this.email,
      password: this.password
    };

    this.authService.login(loginRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Login successful:', response.message);
          this.isLoading = false;
          this.authStateService.setLoggingIn(false);
          this.authStateService.handleAuthSuccess();

          this.toastsService.showToastAdvanced({
            title: 'Welcome Back!',
            message: 'You have been successfully logged in.',
            type: ToastType.Success,
            icon: 'fas fa-check-circle',
            duration: 5000
          });

          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          console.error('Login failed:', error);
          const errorMessage = error.error?.error?.title || 'Invalid email or password';

          this.toastsService.showToastAdvanced({
            title: 'Login Failed',
            message: errorMessage,
            type: ToastType.Error,
            icon: 'fas fa-exclamation-triangle',
            duration: 8000
          });

          this.isLoading = false;
          this.authStateService.setLoggingIn(false);
          this.authStateService.setLoginError(errorMessage);
        }
      });
  }

  // Clear error on input change
  onEmailChange(): void {
    if (this.emailError) {
      this.emailError = false;
    }
  }

  onPasswordChange(): void {
    if (this.passwordError) {
      this.passwordError = false;
    }
  }
}
