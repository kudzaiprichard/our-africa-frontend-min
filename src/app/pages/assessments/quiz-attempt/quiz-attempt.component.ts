// src/app/pages/assessments/quiz-attempt/quiz-attempt.component.ts

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';
import {
  StudentCourseService,
  StartQuizAttemptResponse,
  GetAttemptQuestionsResponse,
  QuestionForQuizAttempt,
  QuizAttemptBasic,
  GetQuizAttemptsResponse
} from '../../../libs/course';

@Component({
  selector: 'app-quiz-attempt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-attempt.component.html',
  styleUrl: './quiz-attempt.component.scss'
})
export class QuizAttemptComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private timerSubscription?: any;
  private isAutoCancelling = false;
  private hasShownWarning = false;

  quizId: string = '';
  moduleId: string = '';
  courseId: string = '';
  attemptId: string = '';

  attempt: QuizAttemptBasic | null = null;
  questions: QuestionForQuizAttempt[] = [];
  quizTitle: string = '';
  timeLimit: number | undefined;
  passMarkPercentage: number = 0;
  maxAttempts: number | undefined;
  attemptNumber: number = 1;
  startTime: Date = new Date();

  currentQuestionIndex: number = 0;
  answers: Map<string, string> = new Map();

  timeRemaining: number = 0;
  isSubmitting: boolean = false;
  isLoading: boolean = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentCourseService: StudentCourseService
  ) {}

  ngOnInit(): void {
    this.setupBeforeUnloadListener();
    this.setupRouteGuard();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.quizId = params['quizId'];
        this.moduleId = params['moduleId'];
        this.courseId = params['courseId'];
        this.attemptId = params['attemptId'] || '';

        if (this.quizId && this.moduleId) {
          this.startQuizAttempt();
        } else {
          this.error = 'Missing quiz or module information';
        }
      });
  }

  ngOnDestroy(): void {
    this.cleanupEventListeners();
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.attempt && !this.isAutoCancelling && !this.isSubmitting) {
      this.showWarningOnUnload(event);
    }
  }

  @HostListener('window:pagehide', ['$event'])
  onPageHide(event: PageTransitionEvent): void {
    if (this.attempt && !this.isAutoCancelling && !this.isSubmitting) {
      this.handlePageLeave();
    }
  }

  @HostListener('window:visibilitychange', ['$event'])
  onVisibilityChange(event: Event): void {
    if (document.hidden && this.attempt && !this.isAutoCancelling && !this.isSubmitting) {
      this.handlePageLeave();
    }
  }

  private setupBeforeUnloadListener(): void {
    window.addEventListener('beforeunload', (event) => {
      if (this.attempt && !this.isAutoCancelling && !this.isSubmitting) {
        this.showWarningOnUnload(event);
      }
    });
  }

  private setupRouteGuard(): void {
    // Override router navigation to catch route changes
    const originalNavigate = this.router.navigate.bind(this.router);
    this.router.navigate = (commands: any[], navigationExtras?: any) => {
      if (this.attempt && !this.isAutoCancelling && !this.isSubmitting && !this.hasShownWarning) {
        const shouldNavigate = this.confirmNavigation();
        if (!shouldNavigate) {
          return Promise.resolve(false);
        }
      }
      return originalNavigate(commands, navigationExtras);
    };
  }

  private cleanupEventListeners(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private showWarningOnUnload(event: BeforeUnloadEvent): void {
    const warningMessage = 'Leaving this page will cancel your quiz attempt. Your progress will be saved but the attempt will be marked as abandoned. Are you sure you want to leave?';
    event.preventDefault();
    event.returnValue = warningMessage;
  }

  private handlePageLeave(): void {
    if (this.hasShownWarning) return;

    this.hasShownWarning = true;
    const shouldCancel = confirm('WARNING: Leaving this page will cancel your quiz attempt. Click "OK" to cancel the quiz, or "Cancel" to stay on the page.');

    if (shouldCancel) {
      this.isAutoCancelling = true;
      this.cancelQuizAutomatically();
    } else {
      // User chose to stay on page
      this.hasShownWarning = false;
    }
  }

  private confirmNavigation(): boolean {
    if (this.hasShownWarning) return true;

    this.hasShownWarning = true;
    const shouldNavigate = confirm('WARNING: Navigating away will cancel your quiz attempt. Click "OK" to cancel the quiz and leave, or "Cancel" to stay on the quiz page.');

    if (!shouldNavigate) {
      this.hasShownWarning = false;
    }

    return shouldNavigate;
  }

  private cancelQuizAutomatically(): void {
    console.log('Quiz automatically cancelled due to page navigation');

    // Stop the timer
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }

    // Navigate back to module content
    this.router.navigate(['/courses/module/content'], {
      queryParams: { moduleId: this.moduleId, courseId: this.courseId }
    });
  }

  startQuizAttempt(): void {
    this.isLoading = true;
    this.error = null;
    this.hasShownWarning = false;

    this.studentCourseService.getModuleContent(this.moduleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (moduleResponse) => {
          const quiz = moduleResponse.quiz;

          if (!quiz) {
            this.error = 'Quiz not found';
            this.isLoading = false;
            return;
          }

          const quizTitle = quiz.title;

          this.studentCourseService.getQuizAttempts(this.quizId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (attemptsResponse: GetQuizAttemptsResponse) => {
                // Check if user already passed this quiz
                const passedAttempt = attemptsResponse.attempts.find(
                  attempt => attempt.passed === true
                );

                if (passedAttempt) {
                  this.router.navigate(['/assessments/quiz/results'], {
                    queryParams: {
                      attemptId: passedAttempt.id,
                      quizId: this.quizId,
                      moduleId: this.moduleId,
                      courseId: this.courseId
                    }
                  });
                  this.isLoading = false;
                  return;
                }

                // Check for incomplete attempts
                const inProgressAttempt = attemptsResponse.attempts.find(
                  (attempt) => attempt.status === 'in_progress'
                );

                if (inProgressAttempt && !this.attemptId) {
                  const message = `You have an incomplete attempt for this quiz started on ${new Date(inProgressAttempt.started_at).toLocaleString()}.\n\nWould you like to continue it?`;

                  if (confirm(message)) {
                    this.loadExistingAttempt(inProgressAttempt.id, quizTitle);
                  } else {
                    this.router.navigate(['/courses/module/content'], {
                      queryParams: { moduleId: this.moduleId, courseId: this.courseId }
                    });
                    this.isLoading = false;
                    return;
                  }
                } else if (this.attemptId) {
                  this.loadExistingAttempt(this.attemptId, quizTitle);
                } else {
                  if (attemptsResponse.remaining_attempts !== undefined && attemptsResponse.remaining_attempts <= 0) {
                    this.error = 'You have used all available attempts for this quiz.';
                    this.isLoading = false;
                    return;
                  }
                  this.startNewQuizAttempt(quizTitle);
                }
              },
              error: () => {
                this.startNewQuizAttempt(quizTitle);
              }
            });
        },
        error: (err) => {
          console.error('Error loading quiz data:', err);
          this.error = 'Failed to load quiz';
          this.isLoading = false;
        }
      });
  }

  private loadExistingAttempt(attemptId: string, title: string): void {
    this.studentCourseService.getAttemptQuestions(attemptId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attemptData: GetAttemptQuestionsResponse) => {
          this.attempt = attemptData.attempt;
          this.questions = attemptData.questions;
          this.quizTitle = attemptData.quiz.title;
          this.timeLimit = attemptData.quiz.time_limit_minutes || undefined;
          this.passMarkPercentage = attemptData.quiz.pass_mark_percentage;
          this.maxAttempts = attemptData.quiz.max_attempts || undefined;
          this.attemptNumber = attemptData.attempt.attempt_number;
          this.startTime = new Date(attemptData.attempt.started_at);

          if (attemptData.submitted_answers) {
            Object.entries(attemptData.submitted_answers).forEach(([questionId, optionId]) => {
              this.answers.set(questionId, optionId);
            });
          }

          if (this.timeLimit) {
            const elapsedMinutes = Math.floor((new Date().getTime() - this.startTime.getTime()) / 60000);
            const remainingMinutes = this.timeLimit - elapsedMinutes;

            if (remainingMinutes > 0) {
              this.timeRemaining = remainingMinutes * 60;
              this.startTimer();
            } else {
              this.submitQuiz();
              return;
            }
          }

          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading existing attempt:', err);
          this.error = 'Failed to resume quiz attempt.';
          this.isLoading = false;
        }
      });
  }

  private startNewQuizAttempt(title: string): void {
    this.studentCourseService.startQuiz(this.quizId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attemptResponse: StartQuizAttemptResponse) => {
          this.attempt = attemptResponse.attempt;
          this.questions = attemptResponse.questions;
          this.quizTitle = attemptResponse.quiz.title;
          this.timeLimit = attemptResponse.quiz.time_limit_minutes || undefined;
          this.passMarkPercentage = attemptResponse.quiz.pass_mark_percentage;
          this.maxAttempts = attemptResponse.quiz.max_attempts || undefined;
          this.attemptNumber = attemptResponse.attempt.attempt_number;
          this.startTime = new Date();

          if (this.timeLimit) {
            this.timeRemaining = this.timeLimit * 60;
            this.startTimer();
          }

          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error starting quiz attempt:', err);
          this.error = 'Failed to start quiz attempt. Please try again.';
          this.isLoading = false;
        }
      });
  }

  startTimer(): void {
    this.timerSubscription = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.timeRemaining > 0) {
          this.timeRemaining--;
          if (this.timeRemaining === 0) {
            this.submitQuiz();
          }
        }
      });
  }

  get quizAttempt() {
    if (!this.attempt) return null;
    return {
      attemptId: this.attempt.id,
      quizTitle: this.quizTitle,
      questions: this.questions,
      timeLimit: this.timeLimit,
      passMarkPercentage: this.passMarkPercentage,
      maxAttempts: this.maxAttempts,
      attemptNumber: this.attemptNumber
    };
  }

  get currentQuestion(): QuestionForQuizAttempt | null {
    if (!this.questions.length) return null;
    return this.questions[this.currentQuestionIndex];
  }

  get totalQuestions(): number {
    return this.questions.length;
  }

  get answeredCount(): number {
    return this.answers.size;
  }

  get progressPercentage(): number {
    if (this.totalQuestions === 0) return 0;
    return Math.round((this.answeredCount / this.totalQuestions) * 100);
  }

  get timeDisplay(): string {
    if (!this.timeLimit) return '∞';
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get isTimeWarning(): boolean {
    if (!this.timeLimit) return false;
    return this.timeRemaining <= 300;
  }

  get canGoPrevious(): boolean {
    return this.currentQuestionIndex > 0;
  }

  get canGoNext(): boolean {
    return this.currentQuestionIndex < this.totalQuestions - 1;
  }

  get isLastQuestion(): boolean {
    return this.currentQuestionIndex === this.totalQuestions - 1;
  }

  isQuestionAnswered(questionId: string): boolean {
    return this.answers.has(questionId);
  }

  isCurrentQuestion(index: number): boolean {
    return this.currentQuestionIndex === index;
  }

  isOptionSelected(optionId: string): boolean {
    if (!this.currentQuestion) return false;
    return this.answers.get(this.currentQuestion.id) === optionId;
  }

  selectOption(optionId: string): void {
    if (!this.currentQuestion || this.isSubmitting || !this.attempt) return;

    const questionId = this.currentQuestion.id;
    const previousAnswer = this.answers.get(questionId);

    this.answers.set(questionId, optionId);

    const answerRequest = {
      attempt_id: this.attempt.id,
      question_id: questionId,
      selected_option_id: optionId
    };

    this.studentCourseService.submitQuizAnswer(this.attempt.id, answerRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {},
        error: () => {
          if (previousAnswer) {
            this.answers.set(questionId, previousAnswer);
          } else {
            this.answers.delete(questionId);
          }
        }
      });
  }

  goToQuestion(index: number): void {
    if (index >= 0 && index < this.totalQuestions) {
      this.currentQuestionIndex = index;
    }
  }

  previousQuestion(): void {
    if (this.canGoPrevious) {
      this.currentQuestionIndex--;
    }
  }

  nextQuestion(): void {
    if (this.canGoNext) {
      this.currentQuestionIndex++;
    }
  }

  submitQuiz(): void {
    if (this.isSubmitting || !this.attempt) return;

    const unansweredCount = this.totalQuestions - this.answeredCount;
    if (unansweredCount > 0 && this.timeRemaining > 0) {
      const confirmSubmit = confirm(
        `You have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirmSubmit) return;
    }

    this.isSubmitting = true;

    this.studentCourseService.completeQuiz(this.attempt.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
          }

          this.router.navigate(['/assessments/quiz/results'], {
            queryParams: {
              attemptId: this.attempt!.id,
              quizId: this.quizId,
              moduleId: this.moduleId,
              courseId: this.courseId
            }
          });
        },
        error: () => {
          alert('Failed to submit quiz. Please try again.');
          this.isSubmitting = false;
        }
      });
  }

  cancelQuiz(): void {
    const confirmCancel = confirm('Are you sure you want to cancel? Your progress will be saved and you can continue later.');
    if (!confirmCancel) return;

    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }

    this.router.navigate(['/courses/module/content'], {
      queryParams: { moduleId: this.moduleId, courseId: this.courseId }
    });
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
