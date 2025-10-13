import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {AssessmentsRoutingModule} from './routes';
import {QuizAttemptComponent} from './quiz-attempt/quiz-attempt.component';
import {QuizResultsComponent} from './quiz-results/quiz-results.component';


@NgModule({
  declarations: [],
  imports: [CommonModule, AssessmentsRoutingModule, QuizAttemptComponent, QuizResultsComponent],
})
export class AssessmentsModule {}
