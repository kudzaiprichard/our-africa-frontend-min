import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {DashboardRoutingModule} from './routes';
import {IndexComponent} from './index/index.component';

@NgModule({
  declarations: [],
  imports: [CommonModule, DashboardRoutingModule, IndexComponent],
})
export class DashboardModule {}
