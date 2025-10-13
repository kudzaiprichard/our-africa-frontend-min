import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {CourseRoutingModule} from './routes';
import {EnrollmentsComponent} from './enrollments/enrollments.component';
import {ModuleContentComponent} from './module-content/module-content.component';
import {CourseDetailsComponent} from './course-details/course-details.component';
import {CourseCatalogComponent} from './course-catalog/course-catalog.component';


@NgModule({
  declarations: [],
  imports: [CommonModule, CourseRoutingModule, EnrollmentsComponent, ModuleContentComponent, CourseDetailsComponent, CourseCatalogComponent],
})
export class DashboardModule {}
