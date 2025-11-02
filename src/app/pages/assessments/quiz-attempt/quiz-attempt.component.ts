// src/app/pages/assessments/quiz-attempt/quiz-attempt.component.ts

import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';

// Updated imports
import { StudentCourseService } from '../../../libs/course';
import {
  StartQuizAttemptResponse,
  GetAttemptQuestionsResponse,
  QuestionForQuizAttempt,
  QuizAttemptBasic,
  GetQuizAttemptsResponse,
  SubmitQuizAnswerRequest
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
  private isNavigating = false;
  private hasAbandonedQuiz = false;

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
    // Setup page leave detection
    this.setupPageLeaveDetection();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.quizId = params['quizId'];
        this.moduleId = params['moduleId'] || 'final-exam';
        this.courseId = params['courseId'];
        this.attemptId = params['attemptId'] || '';

        if (this.quizId) {
          this.startQuizAttempt();
        } else {
          this.error = 'Missing quiz information';
        }
      });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ========== PAGE LEAVE DETECTION ==========

  private setupPageLeaveDetection(): void {
    // Detect browser/tab close
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Detect back button / navigation
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }

  @HostListener('window:beforeunload', ['$event'])
  private handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.attempt && !this.hasAbandonedQuiz && !this.isNavigating) {
      // Show browser warning
      event.preventDefault();
      event.returnValue = '';

      // Try to abandon quiz (may not complete due to browser restrictions)
      this.abandonQuizSync();
    }
  }

  private handlePopState(event: PopStateEvent): void {
    if (this.attempt && !this.hasAbandonedQuiz && !this.isNavigating) {
      event.preventDefault();

      const shouldLeave = confirm(
        'Are you sure you want to leave? Your quiz attempt will be abandoned and you can continue later.'
      );

      if (shouldLeave) {
        this.abandonQuizAndNavigate();
      } else {
        // Push state back to keep user on quiz page
        history.pushState(null, '', location.href);
      }
    }
  }

  private abandonQuizSync(): void {
    if (!this.attempt) return;

    // Use synchronous beacon API for reliable delivery even if page is closing
    const url = `/api/student/attempts/${this.attempt.id}/abandon`;
    const data = JSON.stringify({ attempt_id: this.attempt.id });

    navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
    this.hasAbandonedQuiz = true;
  }

  private abandonQuizAndNavigate(): void {
    if (!this.attempt || this.hasAbandonedQuiz) {
      this.navigateBack();
      return;
    }

    this.hasAbandonedQuiz = true;

    this.studentCourseService.abandonQuiz(this.attempt.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Quiz abandoned successfully');
          this.navigateBack();
        },
        error: (err) => {
          console.error('Failed to abandon quiz:', err);
          // Navigate anyway - backend will handle cleanup
          this.navigateBack();
        }
      });
  }

  private navigateBack(): void {
    this.isNavigating = true;
    this.cleanup();

    // If final exam or no moduleId, go to course details
    if (this.moduleId === 'final-exam' || !this.moduleId) {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: this.courseId }
      });
    } else {
      this.router.navigate(['/courses/module/content'], {
        queryParams: { moduleId: this.moduleId, courseId: this.courseId }
      });
    }
  }

  private cleanup(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }

    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('popstate', this.handlePopState);

    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== QUIZ ATTEMPT LIFECYCLE ==========

  startQuizAttempt(): void {
    this.isLoading = true;
    this.error = null;

    // Check if this is a final exam
    const isFinalExam = this.moduleId === 'final-exam';

    if (isFinalExam) {
      // For final exams, load quiz data directly without module content
      this.loadFinalExamAttempt();
    } else {
      // For module quizzes, load module content first
      this.loadModuleQuizAttempt();
    }
  }

  // Load final exam attempt
  private loadFinalExamAttempt(): void {
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
            const message = `You have an incomplete attempt for this exam started on ${new Date(inProgressAttempt.started_at).toLocaleString()}.\n\nWould you like to continue it?`;

            if (confirm(message)) {
              this.loadExistingAttempt(inProgressAttempt.id, attemptsResponse.quiz.title);
            } else {
              this.router.navigate(['/courses/details'], {
                queryParams: { id: this.courseId }
              });
              this.isLoading = false;
              return;
            }
          } else if (this.attemptId) {
            this.loadExistingAttempt(this.attemptId, attemptsResponse.quiz.title);
          } else {
            if (attemptsResponse.remaining_attempts !== undefined && attemptsResponse.remaining_attempts <= 0) {
              this.error = 'You have used all available attempts for this exam.';
              this.isLoading = false;
              return;
            }
            this.startNewQuizAttempt(attemptsResponse.quiz.title);
          }
        },
        error: (err) => {
          console.error('Error loading final exam attempts:', err);
          this.error = 'Failed to load exam information';
          this.isLoading = false;
        }
      });
  }

  // Load module quiz attempt (original logic)
  private loadModuleQuizAttempt(): void {
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
              // Time already expired - auto-submit
              this.autoSubmitOnTimeout();
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

  // ========== TIMER MANAGEMENT ==========

  startTimer(): void {
    this.timerSubscription = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.timeRemaining > 0) {
          this.timeRemaining--;

          // Auto-submit when time runs out
          if (this.timeRemaining === 0) {
            this.autoSubmitOnTimeout();
          }
        }
      });
  }

  private autoSubmitOnTimeout(): void {
    if (!this.attempt || this.isSubmitting) return;

    alert('Time is up! Your quiz will be submitted automatically with the answers you provided.');

    this.isSubmitting = true;
    this.isNavigating = true;

    // Force submit even with unanswered questions
    this.studentCourseService.completeQuiz(this.attempt.id, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cleanup();

          this.router.navigate(['/assessments/quiz/results'], {
            queryParams: {
              attemptId: this.attempt!.id,
              quizId: this.quizId,
              moduleId: this.moduleId,
              courseId: this.courseId
            }
          });
        },
        error: (err) => {
          console.error('Error auto-submitting quiz:', err);
          alert('Failed to submit quiz. Please try again manually.');
          this.isSubmitting = false;
          this.isNavigating = false;
        }
      });
  }

  // ========== QUIZ INTERACTION ==========

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
    return this.timeRemaining <= 300; // Last 5 minutes
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

    // Create the request using the DTO structure
    const answerRequest: SubmitQuizAnswerRequest = {
      attempt_id: this.attempt.id,
      question_id: questionId,
      selected_option_id: optionId
    };

    this.studentCourseService.submitQuizAnswer(this.attempt.id, answerRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Answer submitted successfully');
        },
        error: (err) => {
          console.error('Error submitting answer:', err);
          // Revert the answer on error
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

  // ========== QUIZ SUBMISSION ==========

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
    this.isNavigating = true;

    this.studentCourseService.completeQuiz(this.attempt.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.cleanup();

          this.router.navigate(['/assessments/quiz/results'], {
            queryParams: {
              attemptId: this.attempt!.id,
              quizId: this.quizId,
              moduleId: this.moduleId,
              courseId: this.courseId
            }
          });
        },
        error: (err) => {
          console.error('Error submitting quiz:', err);
          alert('Failed to submit quiz. Please try again.');
          this.isSubmitting = false;
          this.isNavigating = false;
        }
      });
  }

  cancelQuiz(): void {
    const confirmCancel = confirm(
      'Are you sure you want to leave? Your quiz attempt will be abandoned and you can continue later.'
    );

    if (!confirmCancel) return;

    this.abandonQuizAndNavigate();
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
