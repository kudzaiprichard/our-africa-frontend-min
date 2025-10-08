import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {Router, RouterLink} from '@angular/router';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent {
  constructor(private router: Router) {}

  // Form fields
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;

  // Toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Handle form submission
  onSubmit(): void {
    console.log('Login attempt:', {
      email: this.email,
      password: this.password,
      rememberMe: this.rememberMe
    });

    // Add your login logic here
    alert('Login functionality to be implemented');

    this.router.navigate(['/dashboard']);
  }
}
