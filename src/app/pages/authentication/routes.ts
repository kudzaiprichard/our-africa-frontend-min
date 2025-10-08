
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'register',
    pathMatch: 'full'
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./sign-in/sign-in.component').then(
        (c) => c.SignInComponent
      )
  },
  {
    path: 'login',
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
