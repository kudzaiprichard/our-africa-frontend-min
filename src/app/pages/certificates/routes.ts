import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppLayoutComponent } from '../../theme/layout/app-layout.component';

const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        loadComponent: () =>
          import('./certificates-list/certificates-list.component').then(
            (c) => c.CertificatesListComponent
          )
      },
      {
        path: ':certificateId',
        loadComponent: () =>
          import('./certificate-detail/certificate-detail.component').then(
            (c) => c.CertificateDetailComponent
          )
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CertificatesRoutingModule {}
