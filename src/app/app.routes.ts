import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AuthGuard} from './libs/identity_access/guards/auth.guard';

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
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    loadChildren: () =>
      import('./pages/dashboard/routes').then(
        (m) => m.DashboardRoutingModule
      )
  },
  {
    path: 'assessments',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    loadChildren: () =>
      import('./pages/assessments/routes').then(
        (m) => m.AssessmentsRoutingModule
      )
  },
  {
    path: 'courses',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    loadChildren: () =>
      import('./pages/Courses/routes').then(
        (m) => m.CourseRoutingModule
      )
  },
  {
    path: '**',
    redirectTo: 'authentication'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
