
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {AppLayoutComponent} from '../../theme/layout/app-layout.component';

const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'catalogs',
        pathMatch: 'full'
      },
      {
        path: 'catalogs',
        loadComponent: () =>
          import('./course-catalog/course-catalog.component').then(
            (c) => c.CourseCatalogComponent
          )
      },
      {
        path: 'details',
        loadComponent: () =>
          import('./course-details/course-details.component').then(
            (c) => c.CourseDetailsComponent
          )
      },
      {
        path: 'enrollments',
        loadComponent: () =>
          import('./enrollments/enrollments.component').then(
            (c) => c.EnrollmentsComponent
          )
      },
      {
        path: 'module/content',
        loadComponent: () =>
          import('./module-content/module-content.component').then(
            (c) => c.ModuleContentComponent
          )
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CourseRoutingModule {}
