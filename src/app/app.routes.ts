import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'authentication',
    pathMatch: 'full'
  },
  {
    path: 'authentication',
    loadChildren: () =>
      import('./pages/authentication/routes').then(
        (m) => m.AuthenticationRoutingModule
      )
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./pages/dasboard/routes').then(
        (m) => m.DashboardRoutingModule
      )
  },
  {
    path: '**',
    redirectTo: 'signin'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
