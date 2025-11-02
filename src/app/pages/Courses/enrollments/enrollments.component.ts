// src/app/pages/courses/enrollments/enrollments.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, switchMap, of } from 'rxjs';
import { StudentCourseService } from '../../../libs/course';
import {
  GetStudentEnrollmentsResponse
} from '../../../libs/course';
import {
  EnrollmentWithCourseAndProgress
} from '../../../libs/course';
import { OfflineSyncService } from '../../../theme/shared/services/offline-sync.service';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';
import { ToastsService } from '../../../theme/shared';

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

  downloadedCourses = new Set<string>();
  syncingCourseId: string | null = null;
  downloadingCourseId: string | null = null;
  syncProgress = 0;

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
    private offlineSyncService: OfflineSyncService,
    private connectivityService: ConnectivityService,
    private toasts: ToastsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEnrollments();
    this.checkOfflineStatus();

    this.offlineSyncService.isSyncing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSyncing => {
        if (!isSyncing) {
          this.syncingCourseId = null;
          this.syncProgress = 0;
        }
      });

    this.offlineSyncService.syncProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.syncProgress = progress;
      });
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
          this.toasts.error('Unable to load your enrollments. Please try again.');
        }
      });
  }

  async checkOfflineStatus(): Promise<void> {
    try {
      for (const enrollment of this.allEnrollments) {
        const isDownloaded = await this.studentCourseService.isCourseDownloadedForOffline(enrollment.course_id);
        if (isDownloaded) {
          this.downloadedCourses.add(enrollment.course_id);
        }
      }
    } catch (error) {
      this.toasts.error('Unable to check offline status.');
    }
  }

  isCourseDownloaded(courseId: string): boolean {
    return this.downloadedCourses.has(courseId);
  }

  isOnline(): boolean {
    return this.connectivityService.isOnline();
  }

  async syncCourseProgress(enrollment: EnrollmentWithCourseAndProgress, event: Event): Promise<void> {
    event.stopPropagation();

    if (!this.isCourseDownloaded(enrollment.course_id)) {
      this.toasts.warning('This course is not downloaded for offline use.');
      return;
    }

    if (!this.isOnline()) {
      this.toasts.warning('You need to be online to sync progress.');
      return;
    }

    if (this.syncingCourseId) {
      return;
    }

    const confirmed = confirm(
      `Sync progress for "${enrollment.course.title}"?\n\n` +
      'This will upload your offline progress to the server.'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.syncingCourseId = enrollment.course_id;
      this.toasts.info('Syncing your progress...');

      await this.offlineSyncService.syncAll();

      this.toasts.success('Progress synced successfully!');
      this.loadEnrollments();

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      this.toasts.error(`Failed to sync progress: ${errorMessage}`);
    } finally {
      this.syncingCourseId = null;
      this.syncProgress = 0;
    }
  }

  isSyncing(courseId: string): boolean {
    return this.syncingCourseId === courseId;
  }

  async downloadCourseForOffline(enrollment: EnrollmentWithCourseAndProgress, event: Event): Promise<void> {
    event.stopPropagation();

    if (this.isCourseDownloaded(enrollment.course_id)) {
      this.toasts.info('This course is already downloaded for offline use.');
      return;
    }

    if (this.downloadingCourseId) {
      return;
    }

    const confirmed = confirm(
      `Download "${enrollment.course.title}" for offline use?\n\n` +
      'This will download all course content and media files.'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.downloadingCourseId = enrollment.course_id;
      this.toasts.info('Starting course download for offline access...');

      await this.studentCourseService.downloadCourseForOffline(enrollment.course_id, 7);

      this.toasts.success('Course downloaded successfully! You can now access it offline.');
      this.downloadedCourses.add(enrollment.course_id);

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      this.toasts.error(`Failed to download course: ${errorMessage}`);
    } finally {
      this.downloadingCourseId = null;
    }
  }

  isDownloading(courseId: string): boolean {
    return this.downloadingCourseId === courseId;
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

  continueLearning(enrollment: EnrollmentWithCourseAndProgress, event: Event): void {
    event.stopPropagation();

    if (this.isCompleted(enrollment)) {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: enrollment.course_id }
      });
      return;
    }

    this.continuingCourseId = enrollment.course_id;

    const nextModuleId = enrollment.next_module?.id;

    if (!nextModuleId) {
      this.handleFallbackToFirstModule(enrollment);
      return;
    }

    this.studentCourseService.getModuleResumeData(nextModuleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resumeData) => {
          this.navigateToModuleContent(
            nextModuleId,
            enrollment.course_id,
            resumeData.next_incomplete_content_id
          );
          this.continuingCourseId = null;
        },
        error: (err) => {
          this.toasts.error('Unable to load module data.');
          this.navigateToModuleContent(nextModuleId, enrollment.course_id);
          this.continuingCourseId = null;
        }
      });
  }

  private navigateToModuleContent(
    moduleId: string,
    courseId: string,
    resumeContentId?: string
  ): void {
    const queryParams: any = {
      moduleId: moduleId,
      courseId: courseId
    };

    if (resumeContentId) {
      queryParams.resumeContentId = resumeContentId;
    }

    this.router.navigate(['/courses/module/content'], { queryParams });
  }

  private handleFallbackToFirstModule(enrollment: EnrollmentWithCourseAndProgress): void {
    this.studentCourseService.getCourseModules(enrollment.course_id)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((response) => {
          if (response.modules && response.modules.length > 0) {
            const firstModule = response.modules[0];

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
          this.toasts.error('Unable to load course modules.');
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
