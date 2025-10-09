import { Component, ViewChildren, QueryList, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {AuthService} from '../../../libs/identity_access/services/auth.service';
import {AuthStateService} from '../../../libs/identity_access/services/auth-state.service';
import {
  CompleteRegistrationRequest,
  InitiateEmailVerificationRequest,
  VerifyEmailCodeRequest
} from '../../../libs/identity_access/models/authentication.dtos.interface';


@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.scss']
})
export class SignUpComponent implements OnDestroy {
  @ViewChildren('code1, code2, code3, code4, code5, code6') codeInputs!: QueryList<ElementRef>;

  private destroy$ = new Subject<void>();

  currentStep: number = 1;
  showPassword: boolean = false;
  tempToken: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  // Form data
  formData = {
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    bio: '',
    mobile: '',
    password: ''
  };

  // Verification code array
  verificationCode: string[] = ['', '', '', '', '', ''];

  constructor(
    private authService: AuthService,
    private authStateService: AuthStateService,
    private router: Router
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Navigate to next step
  nextStep(step: number): void {
    this.errorMessage = '';

    if (step === 2) {
      this.sendVerificationCode();
      return;
    }

    if (step === 3) {
      this.verifyCode();
      return;
    }

    if (step === 4) {
      if (!this.formData.firstName || !this.formData.lastName) {
        this.errorMessage = 'Please fill in your first and last name';
        return;
      }
    }

    this.currentStep = step;
  }

  // Send verification code
  private sendVerificationCode(): void {
    if (!this.formData.email) {
      this.errorMessage = 'Please enter your email';
      return;
    }

    this.isLoading = true;
    this.authStateService.setRegistering(true);

    const request: InitiateEmailVerificationRequest = {
      email: this.formData.email,
      purpose: 'registration'
    };

    this.authService.initiateEmailVerification(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Verification code sent:', response.message);
          this.currentStep = 2;
          this.isLoading = false;
          this.authStateService.setRegistering(false);
        },
        error: (error) => {
          console.error('Failed to send verification code:', error);
          this.errorMessage = error.error?.error?.title || 'Failed to send verification code';
          this.isLoading = false;
          this.authStateService.setRegistering(false);
          this.authStateService.setRegisterError(this.errorMessage);
        }
      });
  }

  // Verify code
  private verifyCode(): void {
    const code = this.verificationCode.join('');
    if (code.length !== 6) {
      this.errorMessage = 'Please enter the complete 6-digit code';
      return;
    }

    this.isLoading = true;
    this.authStateService.setRegistering(true);

    const request: VerifyEmailCodeRequest = {
      email: this.formData.email,
      code: code,
      purpose: 'registration'
    };

    this.authService.verifyEmailCode(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Email verified:', response.message);
          this.tempToken = response.temp_token || '';
          this.authStateService.setTempToken(this.tempToken);
          this.authStateService.setVerifiedEmail(this.formData.email);
          this.currentStep = 3;
          this.isLoading = false;
          this.authStateService.setRegistering(false);
        },
        error: (error) => {
          console.error('Verification failed:', error);
          this.errorMessage = error.error?.error?.title || 'Invalid verification code';
          this.isLoading = false;
          this.authStateService.setRegistering(false);
          this.authStateService.setRegisterError(this.errorMessage);
        }
      });
  }

  // Navigate to previous step
  prevStep(step: number): void {
    this.errorMessage = '';
    this.currentStep = step;
  }

  // Handle code input
  onCodeInput(event: any, index: number): void {
    const value = event.target.value;
    if (value.length === 1 && index < 5) {
      const inputs = this.codeInputs.toArray();
      inputs[index + 1].nativeElement.focus();
    }
  }

  // Handle code keydown
  onCodeKeydown(event: any, index: number): void {
    if (event.key === 'Backspace' && event.target.value === '' && index > 0) {
      const inputs = this.codeInputs.toArray();
      inputs[index - 1].nativeElement.focus();
    }
  }

  // Resend verification code
  resendCode(): void {
    this.errorMessage = '';
    this.verificationCode = ['', '', '', '', '', ''];

    this.isLoading = true;

    const request: InitiateEmailVerificationRequest = {
      email: this.formData.email,
      purpose: 'registration'
    };

    this.authService.resendVerificationCode(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Verification code resent:', response.message);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Failed to resend code:', error);
          this.errorMessage = error.error?.error?.title || 'Failed to resend verification code';
          this.isLoading = false;
        }
      });
  }

  // Toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Complete signup
  completeSignup(): void {
    if (!this.formData.mobile || !this.formData.password) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    if (!this.tempToken) {
      this.errorMessage = 'Verification token missing. Please restart registration.';
      return;
    }

    this.isLoading = true;
    this.authStateService.setRegistering(true);

    const request: CompleteRegistrationRequest = {
      temp_token: this.tempToken,
      first_name: this.formData.firstName,
      last_name: this.formData.lastName,
      password: this.formData.password,
      middle_name: this.formData.middleName || undefined,
      bio: this.formData.bio || undefined,
      phone_number: this.formData.mobile || undefined
    };

    this.authService.completeRegistration(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Registration complete:', response.message);
          this.currentStep = 5;
          this.isLoading = false;
          this.authStateService.setRegistering(false);
          this.authStateService.clearRegisterState();
        },
        error: (error) => {
          console.error('Registration failed:', error);
          this.errorMessage = error.error?.error?.title || 'Registration failed';
          this.isLoading = false;
          this.authStateService.setRegistering(false);
          this.authStateService.setRegisterError(this.errorMessage);
        }
      });
  }

  // Go to login
  goToLogin(): void {
    this.router.navigate(['/authentication/signin']);
  }
}
