import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CertificatesRoutingModule } from './routes';
import { CertificatesListComponent } from './certificates-list/certificates-list.component';
import { CertificateDetailComponent } from './certificate-detail/certificate-detail.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    CertificatesRoutingModule,
    CertificatesListComponent,
    CertificateDetailComponent
  ],
})
export class CertificatesModule {}
