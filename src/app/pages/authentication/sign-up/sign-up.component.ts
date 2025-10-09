import { Component, ViewChildren, QueryList, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../libs/identity_access/services/auth.service';
import { AuthStateService } from '../../../libs/identity_access/services/auth-state.service';
import {
  CompleteRegistrationRequest,
  InitiateEmailVerificationRequest,
  VerifyEmailCodeRequest
} from '../../../libs/identity_access/models/authentication.dtos.interface';
import { ToastsService, ToastType } from '../../../theme/shared';

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
  completingRegistration: boolean = false;
  registrationTitle: string = '';
  registrationMessage: string = '';

  // Validation error states
  emailError: boolean = false;
  firstNameError: boolean = false;
  lastNameError: boolean = false;
  mobileError: boolean = false;
  passwordError: boolean = false;
  codeError: boolean = false;

  formData = {
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    bio: '',
    mobile: '',
    password: ''
  };

  verificationCode: string[] = ['', '', '', '', '', ''];

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

  nextStep(step: number): void {
    if (step === 2) {
      this.sendVerificationCode();
      return;
    }

    if (step === 3) {
      this.verifyCode();
      return;
    }

    if (step === 4) {
      this.validateProfileStep();
      return;
    }

    this.currentStep = step;
  }

  private validateProfileStep(): void {
    this.firstNameError = false;
    this.lastNameError = false;

    if (!this.formData.firstName && !this.formData.lastName) {
      this.firstNameError = true;
      this.lastNameError = true;
      this.toastsService.showToastAdvanced({
        title: 'Validation Error',
        message: 'Please fill in your first and last name',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.formData.firstName) {
      this.firstNameError = true;
      this.toastsService.showToastAdvanced({
        title: 'First Name Required',
        message: 'Please enter your first name',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.formData.lastName) {
      this.lastNameError = true;
      this.toastsService.showToastAdvanced({
        title: 'Last Name Required',
        message: 'Please enter your last name',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    this.currentStep = 4;
  }

  private sendVerificationCode(): void {
    this.emailError = false;

    if (!this.formData.email) {
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

          this.toastsService.showToastAdvanced({
            title: 'Code Sent',
            message: 'Verification code has been sent to your email',
            type: ToastType.Success,
            icon: 'fas fa-check-circle',
            duration: 5000
          });
        },
        error: (error) => {
          console.error('Failed to send verification code:', error);
          const errorMessage = error.error?.error?.title || 'Failed to send verification code';

          this.toastsService.showToastAdvanced({
            title: 'Registration Failed',
            message: errorMessage,
            type: ToastType.Error,
            icon: 'fas fa-exclamation-triangle',
            duration: 8000
          });

          this.isLoading = false;
          this.authStateService.setRegistering(false);
          this.authStateService.setRegisterError(errorMessage);
        }
      });
  }

  private verifyCode(): void {
    this.codeError = false;
    const code = this.verificationCode.join('');

    if (code.length !== 6) {
      this.codeError = true;
      this.toastsService.showToastAdvanced({
        title: 'Code Required',
        message: 'Please enter the complete 6-digit verification code',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
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

          this.toastsService.showToastAdvanced({
            title: 'Email Verified',
            message: 'Your email has been successfully verified',
            type: ToastType.Success,
            icon: 'fas fa-check-circle',
            duration: 5000
          });
        },
        error: (error) => {
          console.error('Verification failed:', error);
          const errorMessage = error.error?.error?.title || 'Invalid verification code';

          this.toastsService.showToastAdvanced({
            title: 'Verification Failed',
            message: errorMessage,
            type: ToastType.Error,
            icon: 'fas fa-exclamation-triangle',
            duration: 8000
          });

          this.isLoading = false;
          this.authStateService.setRegistering(false);
          this.authStateService.setRegisterError(errorMessage);
        }
      });
  }

  prevStep(step: number): void {
    this.currentStep = step;
  }

  onCodeInput(event: any, index: number): void {
    const value = event.target.value;
    if (this.codeError) {
      this.codeError = false;
    }
    if (value.length === 1 && index < 5) {
      const inputs = this.codeInputs.toArray();
      inputs[index + 1].nativeElement.focus();
    }
  }

  onCodeKeydown(event: any, index: number): void {
    if (event.key === 'Backspace' && event.target.value === '' && index > 0) {
      const inputs = this.codeInputs.toArray();
      inputs[index - 1].nativeElement.focus();
    }
  }

  resendCode(): void {
    this.verificationCode = ['', '', '', '', '', ''];
    this.codeError = false;
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

          this.toastsService.showToastAdvanced({
            title: 'Code Resent',
            message: 'A new verification code has been sent to your email',
            type: ToastType.Success,
            icon: 'fas fa-check-circle',
            duration: 5000
          });
        },
        error: (error) => {
          console.error('Failed to resend code:', error);
          const errorMessage = error.error?.error?.title || 'Failed to resend verification code';

          this.toastsService.showToastAdvanced({
            title: 'Resend Failed',
            message: errorMessage,
            type: ToastType.Error,
            icon: 'fas fa-exclamation-triangle',
            duration: 8000
          });

          this.isLoading = false;
        }
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  completeSignup(): void {
    this.mobileError = false;
    this.passwordError = false;

    if (!this.formData.mobile && !this.formData.password) {
      this.mobileError = true;
      this.passwordError = true;
      this.toastsService.showToastAdvanced({
        title: 'Validation Error',
        message: 'Please fill in your mobile number and password',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.formData.mobile) {
      this.mobileError = true;
      this.toastsService.showToastAdvanced({
        title: 'Mobile Number Required',
        message: 'Please enter your mobile number',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.formData.password) {
      this.passwordError = true;
      this.toastsService.showToastAdvanced({
        title: 'Password Required',
        message: 'Please create a password',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 5000
      });
      return;
    }

    if (!this.tempToken) {
      this.toastsService.showToastAdvanced({
        title: 'Token Missing',
        message: 'Verification token missing. Please restart registration.',
        type: ToastType.Error,
        icon: 'fas fa-exclamation-circle',
        duration: 8000
      });
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

          // Move to success step and start creating account phase
          this.currentStep = 5;
          this.isLoading = false;
          this.registrationTitle = 'Creating Account';
          this.registrationMessage = 'Setting up your account...';

          // Phase 1: Creating account messages
          setTimeout(() => {
            this.registrationMessage = 'Creating basic account settings...';

            setTimeout(() => {
              this.registrationMessage = 'Initializing user profile...';

              setTimeout(() => {
                this.registrationMessage = 'Configuring preferences...';

                // Phase 2: Login phase
                setTimeout(() => {
                  this.registrationTitle = 'Logging into System';
                  this.registrationMessage = 'Authenticating credentials...';

                  setTimeout(() => {
                    this.registrationMessage = 'Performing security checks...';

                    setTimeout(() => {
                      this.registrationMessage = 'Loading dashboard...';

                      // Redirect after final message
                      setTimeout(() => {
                        this.authStateService.setRegistering(false);
                        this.authStateService.clearRegisterState();
                        this.router.navigate(['/dashboard']);
                      }, 1500);
                    }, 1100);
                  }, 1100);
                }, 800);
              }, 1200);
            }, 1500);
          }, 100);
        },
        error: (error) => {
          console.error('Registration failed:', error);
          const errorMessage = error.error?.error?.title || 'Registration failed';

          this.toastsService.showToastAdvanced({
            title: 'Registration Failed',
            message: errorMessage,
            type: ToastType.Error,
            icon: 'fas fa-exclamation-triangle',
            duration: 8000
          });

          this.isLoading = false;
          this.completingRegistration = false;
          this.authStateService.setRegistering(false);
          this.authStateService.setRegisterError(errorMessage);
        }
      });
  }

  goToLogin(): void {
    this.router.navigate(['/authentication/signin']);
  }

  // Clear error handlers
  onEmailChange(): void {
    if (this.emailError) this.emailError = false;
  }

  onFirstNameChange(): void {
    if (this.firstNameError) this.firstNameError = false;
  }

  onLastNameChange(): void {
    if (this.lastNameError) this.lastNameError = false;
  }

  onMobileChange(): void {
    if (this.mobileError) this.mobileError = false;
  }

  onPasswordChange(): void {
    if (this.passwordError) this.passwordError = false;
  }
}
