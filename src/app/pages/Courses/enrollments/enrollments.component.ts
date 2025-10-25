// src/app/pages/courses/enrollments/enrollments.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, switchMap, of } from 'rxjs';

// Updated imports
import { StudentCourseService } from '../../../libs/course';
import {
  GetStudentEnrollmentsResponse
} from '../../../libs/course';
import {
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
    // Use the category field from CourseBasic
    return enrollment.course.category || 'General';
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

  /**
   * ✅ UPDATED: Continue Learning with Resume Feature
   * Now uses getModuleResumeData() to jump to exact content block
   */
  continueLearning(enrollment: EnrollmentWithCourseAndProgress, event: Event): void {
    event.stopPropagation();

    // If course is completed, just view course details
    if (this.isCompleted(enrollment)) {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: enrollment.course_id }
      });
      return;
    }

    this.continuingCourseId = enrollment.course_id;

    // Check if we have next_module from enrollment
    const nextModuleId = enrollment.next_module?.id;

    if (!nextModuleId) {
      // No next module - fallback to first module
      this.handleFallbackToFirstModule(enrollment);
      return;
    }

    // ✅ NEW: Get resume data for the next module
    this.studentCourseService.getModuleResumeData(nextModuleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resumeData) => {
          console.log('✅ Resume data fetched:', resumeData);

          // Navigate to module with resume content ID
          this.navigateToModuleContent(
            nextModuleId,
            enrollment.course_id,
            resumeData.next_incomplete_content_id
          );

          this.continuingCourseId = null;
        },
        error: (err) => {
          console.error('❌ Error fetching resume data:', err);

          // Fallback: Navigate to module without specific content
          this.navigateToModuleContent(nextModuleId, enrollment.course_id);
          this.continuingCourseId = null;
        }
      });
  }

  /**
   * ✅ NEW: Navigate to module content with optional resume content
   * Handles both resume and fresh start scenarios
   */
  private navigateToModuleContent(
    moduleId: string,
    courseId: string,
    resumeContentId?: string
  ): void {
    const queryParams: any = {
      moduleId: moduleId,
      courseId: courseId
    };

    // If we have a specific content to resume from, add it to query params
    if (resumeContentId) {
      queryParams.resumeContentId = resumeContentId;
      console.log(`🎯 Resuming at content: ${resumeContentId}`);
    } else {
      console.log('🆕 Starting module from beginning');
    }

    this.router.navigate(['/courses/module/content'], { queryParams });
  }

  /**
   * ✅ NEW: Fallback handler when no next_module available
   * Fetches course modules and starts with the first one
   */
  private handleFallbackToFirstModule(enrollment: EnrollmentWithCourseAndProgress): void {
    this.studentCourseService.getCourseModules(enrollment.course_id)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((response) => {
          if (response.modules && response.modules.length > 0) {
            const firstModule = response.modules[0];

            // Try to get resume data for first module
            return this.studentCourseService.getModuleResumeData(firstModule.id)
              .pipe(
                takeUntil(this.destroy$),
                switchMap((resumeData) => {
                  this.navigateToModuleContent(
                    firstModule.id,
                    enrollment.course_id,
                    resumeData.next_incomplete_content_id
                  );
                  return of(null);
                })
              );
          } else {
            // No modules found - go to course details
            this.router.navigate(['/courses/details'], {
              queryParams: { id: enrollment.course_id }
            });
            return of(null);
          }
        })
      )
      .subscribe({
        next: () => {
          this.continuingCourseId = null;
        },
        error: (err) => {
          console.error('❌ Error in fallback module fetch:', err);
          // Final fallback - just go to course details
          this.router.navigate(['/courses/details'], {
            queryParams: { id: enrollment.course_id }
          });
          this.continuingCourseId = null;
        }
      });
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
