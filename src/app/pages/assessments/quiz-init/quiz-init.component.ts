// src/app/pages/assessments/quiz-init/quiz-init.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Updated imports
import { StudentCourseService } from '../../../libs/course';
import {
  QuizForStudent,
  ModuleWithProgress
} from '../../../libs/course';

@Component({
  selector: 'app-quiz-init',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-init.component.html',
  styleUrl: './quiz-init.component.scss'
})
export class QuizInitComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  quizId: string = '';
  moduleId: string = '';
  courseId: string = '';
  isFinalExam: boolean = false;

  quiz: QuizForStudent | null = null;
  module: ModuleWithProgress | null = null;
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
        this.quizId = params['quizId'];
        this.moduleId = params['moduleId'];
        this.courseId = params['courseId'];
        this.isFinalExam = params['isFinalExam'] === 'true';

        if (this.quizId && (this.moduleId || this.isFinalExam)) {
          if (this.isFinalExam) {
            this.loadFinalExamData();
          } else {
            this.loadQuizData();
          }
        } else {
          this.error = 'Missing quiz or module information';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuizData(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getModuleContent(this.moduleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.quiz = response.quiz || null;
          this.module = response.module;
          this.isLoading = false;

          // Optionally check if quiz exists
          if (!this.quiz) {
            this.error = 'No quiz found for this module';
          }
        },
        error: (err) => {
          console.error('Error loading quiz data:', err);
          this.error = 'Failed to load quiz information';
          this.isLoading = false;
        }
      });
  }

  // ✅ NEW: Load final exam data without requiring module
  loadFinalExamData(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getQuizQuestions(this.quizId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.quiz = response.quiz;
          this.module = null; // No module for final exam
          this.isLoading = false;

          if (!this.quiz) {
            this.error = 'No quiz found';
          }
        },
        error: (err) => {
          console.error('Error loading final exam data:', err);
          this.error = 'Failed to load exam information';
          this.isLoading = false;
        }
      });
  }

  startQuiz(): void {
    if (!this.quiz) return;

    this.router.navigate(['/assessments/quiz/attempt'], {
      queryParams: {
        quizId: this.quiz.id,
        moduleId: this.moduleId || 'final-exam',
        courseId: this.courseId,
        isFinalExam: this.isFinalExam
      }
    });
  }

  cancel(): void {
    // ✅ If final exam, go back to course details; otherwise go to module content
    if (this.isFinalExam || !this.moduleId) {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: this.courseId }
      });
    } else {
      this.router.navigate(['/courses/module/content'], {
        queryParams: {
          moduleId: this.moduleId,
          courseId: this.courseId
        }
      });
    }
  }

  get quizTitle(): string {
    return this.quiz?.title || '';
  }

  get moduleTitle(): string {
    // ✅ Show "Final Exam" if it's a final exam
    if (this.isFinalExam) {
      return 'Final Exam';
    }
    return this.module?.title || '';
  }

  get timeLimit(): number | undefined {
    return this.quiz?.time_limit_minutes || undefined;
  }

  get passMarkPercentage(): number {
    return this.quiz?.pass_mark_percentage || 0;
  }

  get maxAttempts(): number | undefined {
    return this.quiz?.max_attempts || undefined;
  }

  get questionCount(): number {
    return this.quiz?.question_count || 0;
  }

  getPassingQuestionsCount(): number {
    if (!this.quiz || !this.quiz.question_count) return 0;
    return Math.ceil((this.quiz.question_count * this.quiz.pass_mark_percentage) / 100);
  }
}
