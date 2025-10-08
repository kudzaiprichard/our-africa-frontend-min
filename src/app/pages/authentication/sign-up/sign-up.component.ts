import { Component, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.scss']
})
export class SignUpComponent {
  @ViewChildren('code1, code2, code3, code4, code5, code6') codeInputs!: QueryList<ElementRef>;

  currentStep: number = 1;
  showPassword: boolean = false;

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

  // Navigate to next step
  nextStep(step: number): void {
    if (step === 2) {
      if (!this.formData.email) {
        alert('Please enter your email');
        return;
      }
      console.log('Sending verification code to:', this.formData.email);
    }

    if (step === 3) {
      const code = this.verificationCode.join('');
      if (code.length !== 6) {
        alert('Please enter the complete 6-digit code');
        return;
      }
      console.log('Verifying code:', code);
    }

    if (step === 4) {
      if (!this.formData.firstName || !this.formData.lastName) {
        alert('Please fill in your first and last name');
        return;
      }
    }

    this.currentStep = step;
  }

  // Navigate to previous step
  prevStep(step: number): void {
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
    console.log('Resending verification code');
    alert('Verification code resent!');
  }

  // Toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Complete signup
  completeSignup(): void {
    if (!this.formData.mobile || !this.formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    console.log('Registration complete:', this.formData);

    // Show success step
    this.currentStep = 5;
  }

  // Go to login
  goToLogin(): void {
    console.log('Redirecting to login...');
    // Add navigation logic here
  }
}
