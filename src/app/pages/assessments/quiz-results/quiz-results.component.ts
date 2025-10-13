// src/app/pages/assessments/quiz-results/quiz-results.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  StudentCourseService,
  GetQuizResultsResponse,
  QuestionWithAnswerResult
} from '../../../libs/course';

type FilterType = 'all' | 'correct' | 'incorrect';

@Component({
  selector: 'app-quiz-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-results.component.html',
  styleUrl: './quiz-results.component.scss'
})
export class QuizResultsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  attemptId: string = '';
  quizId: string = '';
  moduleId: string = '';
  courseId: string = '';

  quizResults: GetQuizResultsResponse | null = null;
  filteredQuestions: QuestionWithAnswerResult[] = [];
  activeFilter: FilterType = 'all';

  isLoading = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentCourseService: StudentCourseService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.attemptId = params['attemptId'];
        this.quizId = params['quizId'];
        this.moduleId = params['moduleId'];
        this.courseId = params['courseId'];

        if (this.attemptId) {
          this.loadQuizResults();
        } else {
          this.error = 'Missing attempt information';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuizResults(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getQuizResults(this.attemptId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetQuizResultsResponse) => {
          this.quizResults = response;
          this.applyFilter('all');
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading quiz results:', err);
          this.error = 'Failed to load quiz results';
          this.isLoading = false;
        }
      });
  }

  applyFilter(filter: FilterType): void {
    this.activeFilter = filter;

    if (!this.quizResults) {
      this.filteredQuestions = [];
      return;
    }

    switch (filter) {
      case 'correct':
        this.filteredQuestions = this.quizResults.questions_with_answers.filter(q => q.is_correct);
        break;
      case 'incorrect':
        this.filteredQuestions = this.quizResults.questions_with_answers.filter(q => !q.is_correct);
        break;
      default:
        this.filteredQuestions = this.quizResults.questions_with_answers;
    }
  }

  isFilterActive(filter: FilterType): boolean {
    return this.activeFilter === filter;
  }

  get results() {
    if (!this.quizResults) return null;

    const totalQuestions = this.quizResults.questions_with_answers.length;
    const correctAnswers = this.quizResults.questions_with_answers.filter(q => q.is_correct).length;
    const incorrectAnswers = totalQuestions - correctAnswers;

    return {
      score: this.quizResults.score,
      passed: this.quizResults.passed,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      completedAt: this.quizResults.attempt.completed_at || this.quizResults.attempt.started_at,
      timeTaken: this.calculateTimeTaken()
    };
  }

  calculateTimeTaken(): string {
    if (!this.quizResults) return 'N/A';

    const started = new Date(this.quizResults.attempt.started_at);
    const completed = new Date(this.quizResults.attempt.completed_at || this.quizResults.attempt.started_at);
    const diffMs = completed.getTime() - started.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  }

  get statusIcon(): string {
    return this.results?.passed ? 'fa-check-circle' : 'fa-times-circle';
  }

  get statusText(): string {
    return this.results?.passed ? 'Quiz Passed!' : 'Quiz Failed';
  }

  isCorrectOption(question: QuestionWithAnswerResult, optionId: string): boolean {
    return question.correct_option_id === optionId;
  }

  isWrongAnswer(question: QuestionWithAnswerResult, optionId: string): boolean {
    return question.student_selected_option_id === optionId && !question.is_correct;
  }

  isStudentAnswer(question: QuestionWithAnswerResult, optionId: string): boolean {
    return question.student_selected_option_id === optionId;
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  retakeQuiz(): void {
    this.router.navigate(['/assessments/quiz/initiate'], {
      queryParams: {
        quizId: this.quizId,
        moduleId: this.moduleId,
        courseId: this.courseId
      }
    });
  }

  continueLearning(): void {
    this.router.navigate(['/courses/module/content'], {
      queryParams: {
        moduleId: this.moduleId,
        courseId: this.courseId
      }
    });
  }

  downloadResults(): void {
    if (!this.quizResults) return;

    const resultsText = this.generateResultsText();
    const blob = new Blob([resultsText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quiz-results-${this.attemptId}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private generateResultsText(): string {
    if (!this.quizResults || !this.results) return '';

    let text = `Quiz Results\n`;
    text += `=============\n\n`;
    text += `Quiz: ${this.quizResults.quiz.title}\n`;
    text += `Status: ${this.results.passed ? 'PASSED' : 'FAILED'}\n`;
    text += `Score: ${this.results.score.toFixed(2)}%\n`;
    text += `Correct: ${this.results.correctAnswers}/${this.results.totalQuestions}\n`;
    text += `Time Taken: ${this.results.timeTaken}\n`;
    text += `Completed: ${new Date(this.results.completedAt).toLocaleString()}\n\n`;
    text += `Detailed Review\n`;
    text += `===============\n\n`;

    this.quizResults.questions_with_answers.forEach((q, i) => {
      text += `Question ${i + 1}: ${q.is_correct ? '✓' : '✗'}\n`;
      text += `${q.question_text}\n`;
      text += `Points: ${q.points_earned}/${q.points}\n\n`;
    });

    return text;
  }
}
