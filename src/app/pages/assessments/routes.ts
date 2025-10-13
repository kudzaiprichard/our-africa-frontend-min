
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
        redirectTo: 'quiz/initiate',
        pathMatch: 'full'
      },
      {
        path: 'quiz/initiate',
        loadComponent: () =>
          import('./quiz-init/quiz-init.component').then(
            (c) => c.QuizInitComponent
          )
      },
      {
        path: 'quiz/attempt',
        loadComponent: () =>
          import('./quiz-attempt/quiz-attempt.component').then(
            (c) => c.QuizAttemptComponent
          )
      },
      {
        path: 'quiz/results',
        loadComponent: () =>
          import('./quiz-results/quiz-results.component').then(
            (c) => c.QuizResultsComponent
          )
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AssessmentsRoutingModule {}
