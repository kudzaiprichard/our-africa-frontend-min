import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {AuthenticationRoutingModule} from './routes';
import {SignInComponent} from './sign-in/sign-in.component';
import {SignUpComponent} from './sign-up/sign-up.component';

@NgModule({
  declarations: [],
  imports: [CommonModule, AuthenticationRoutingModule, SignInComponent, SignUpComponent],
})
export class AuthenticationModule {}
