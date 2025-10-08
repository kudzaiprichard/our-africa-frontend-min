
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'signin',
    pathMatch: 'full'
  },
  {
    path: 'signin',
    loadComponent: () =>
      import('./sign-in/sign-in.component').then(
        (c) => c.SignInComponent
      )
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./sign-up/sign-up.component').then(
        (c) => c.SignUpComponent
      )
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthenticationRoutingModule {}
