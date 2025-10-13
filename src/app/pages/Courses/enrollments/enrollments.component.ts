// src/app/pages/courses/enrollments/enrollments.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  GetStudentEnrollmentsResponse,
  StudentCourseService,
  EnrollmentWithCourseAndProgress
} from '../../../libs/course';

@Component({
  selector: 'app-enrollments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './enrollments.component.html',
  styleUrl: './enrollments.component.scss'
})
export class EnrollmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  allEnrollments: EnrollmentWithCourseAndProgress[] = [];
  displayedEnrollments: EnrollmentWithCourseAndProgress[] = [];
  activeTab: 'all' | 'in-progress' | 'completed' = 'all';

  isLoading = false;
  error: string | null = null;
  continuingCourseId: string | null = null;

  private gradients = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #0891b2)',
    'linear-gradient(135deg, #f97316, #dc2626)',
    'linear-gradient(135deg, #a855f7, #6366f1)',
  ];

  private icons = [
    'fa-code',
    'fa-database',
    'fa-paint-brush',
    'fa-globe',
    'fa-mobile-alt',
    'fa-laptop-code',
    'fa-chart-line',
    'fa-terminal',
  ];

  constructor(
    private studentCourseService: StudentCourseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEnrollments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEnrollments(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getMyEnrollments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetStudentEnrollmentsResponse) => {
          this.allEnrollments = response.enrollments;
          this.filterEnrollments();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load enrollments';
          this.isLoading = false;
          console.error('Error loading enrollments:', err);
        }
      });
  }

  filterEnrollments(): void {
    switch (this.activeTab) {
      case 'in-progress':
        this.displayedEnrollments = this.allEnrollments.filter(e => !this.isCompleted(e));
        break;
      case 'completed':
        this.displayedEnrollments = this.allEnrollments.filter(e => this.isCompleted(e));
        break;
      default:
        this.displayedEnrollments = [...this.allEnrollments];
    }
  }

  setActiveTab(tab: 'all' | 'in-progress' | 'completed'): void {
    this.activeTab = tab;
    this.filterEnrollments();
  }

  get allCount(): number {
    return this.allEnrollments.length;
  }

  get inProgressCount(): number {
    return this.allEnrollments.filter(e => !this.isCompleted(e)).length;
  }

  get completedCount(): number {
    return this.allEnrollments.filter(e => this.isCompleted(e)).length;
  }

  isCompleted(enrollment: EnrollmentWithCourseAndProgress): boolean {
    return enrollment.status === 'completed' || !!enrollment.completed_at;
  }

  getProgressPercentage(enrollment: EnrollmentWithCourseAndProgress): number {
    return enrollment.progress.completion_percentage || 0;
  }

  getCompletedModules(enrollment: EnrollmentWithCourseAndProgress): number {
    return enrollment.progress.completed_modules || 0;
  }

  getTotalModules(enrollment: EnrollmentWithCourseAndProgress): number {
    return enrollment.progress.total_modules || 0;
  }

  getBannerGradient(index: number): string {
    return this.gradients[index % this.gradients.length];
  }

  getBannerIcon(index: number): string {
    return this.icons[index % this.icons.length];
  }

  getCategory(enrollment: EnrollmentWithCourseAndProgress): string {
    if (enrollment.course.categories_display && enrollment.course.categories_display.length > 0) {
      return enrollment.course.categories_display[0];
    }
    return 'Programming';
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getEstimatedTimeLeft(enrollment: EnrollmentWithCourseAndProgress): string {
    const remainingModules = this.getTotalModules(enrollment) - this.getCompletedModules(enrollment);
    const hoursPerModule = 3;
    const totalHours = remainingModules * hoursPerModule;
    return `${totalHours}h left`;
  }

  continueLearning(enrollment: EnrollmentWithCourseAndProgress, event: Event): void {
    event.stopPropagation();

    if (this.isCompleted(enrollment)) {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: enrollment.course_id }
      });
      return;
    }

    this.continuingCourseId = enrollment.course_id;

    if (enrollment.next_module?.id) {
      this.router.navigate(['/courses/module/content'], {
        queryParams: {
          moduleId: enrollment.next_module.id,
          courseId: enrollment.course_id
        }
      });
      this.continuingCourseId = null;
    } else {
      this.studentCourseService.getCourseModules(enrollment.course_id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.modules && response.modules.length > 0) {
              const firstModule = response.modules[0];
              this.router.navigate(['/courses/module/content'], {
                queryParams: {
                  moduleId: firstModule.id,
                  courseId: enrollment.course_id
                }
              });
            } else {
              this.router.navigate(['/courses/details'], {
                queryParams: { id: enrollment.course_id }
              });
            }
            this.continuingCourseId = null;
          },
          error: (err) => {
            console.error('Error fetching modules:', err);
            this.router.navigate(['/courses/details'], {
              queryParams: { id: enrollment.course_id }
            });
            this.continuingCourseId = null;
          }
        });
    }
  }

  isContinueLoading(enrollment: EnrollmentWithCourseAndProgress): boolean {
    return this.continuingCourseId === enrollment.course_id;
  }

  viewProgress(enrollment: EnrollmentWithCourseAndProgress, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/courses/details'], {
      queryParams: { id: enrollment.course_id }
    });
  }

  viewCourseDetails(enrollment: EnrollmentWithCourseAndProgress): void {
    this.router.navigate(['/courses/details'], {
      queryParams: { id: enrollment.course_id }
    });
  }

  browseCourses(): void {
    this.router.navigate(['/courses/catalogs']);
  }

  getProgressBarWidth(enrollment: EnrollmentWithCourseAndProgress): string {
    return `${this.getProgressPercentage(enrollment)}%`;
  }
}
