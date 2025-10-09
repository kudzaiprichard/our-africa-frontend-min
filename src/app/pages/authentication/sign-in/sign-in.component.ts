import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {AuthService} from '../../../libs/identity_access/services/auth.service';
import {AuthStateService} from '../../../libs/identity_access/services/auth-state.service';
import {LoginRequest} from '../../../libs/identity_access/models/authentication.dtos.interface';


@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  // Form fields
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private authStateService: AuthStateService,
    private router: Router
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Handle form submission
  onSubmit(): void {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter your email and password';
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

          // Navigate to dashboard
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          console.error('Login failed:', error);
          this.errorMessage = error.error?.error?.title || 'Invalid email or password';
          this.isLoading = false;
          this.authStateService.setLoggingIn(false);
          this.authStateService.setLoginError(this.errorMessage);
        }
      });
  }
}
