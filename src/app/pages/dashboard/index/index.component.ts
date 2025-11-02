// src/app/pages/dashboard/index/index.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { UserService } from '../../../libs/identity_access/services/user.service';
import { StudentCourseService } from '../../../libs/course';
import {
  GetStudentDashboardResponse,
  EnrollmentWithCourseAndProgressSummary
} from '../../../libs/course';
import {
  GetAvailableCoursesResponse
} from '../../../libs/course';
import { OfflineSyncService } from '../../../theme/shared/services/offline-sync.service';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';
import { ToastsService } from '../../../theme/shared';

interface ActivityItem {
  type: 'quiz' | 'module' | 'enrollment';
  icon: string;
  title: string;
  subtitle: string;
  time: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  dashboardData: GetStudentDashboardResponse | null = null;
  availableCourses: GetAvailableCoursesResponse | null = null;
  recentActivities: ActivityItem[] = [];
  isLoading = false;
  error: string | null = null;

  downloadedCourses = new Set<string>();
  syncingCourseId: string | null = null;
  downloadingCourseId: string | null = null;

  constructor(
    private studentCourseService: StudentCourseService,
    private offlineSyncService: OfflineSyncService,
    private connectivityService: ConnectivityService,
    private toasts: ToastsService,
    public userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadAvailableCourses();
    this.checkOfflineStatus();

    this.offlineSyncService.isSyncing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isSyncing => {
        if (!isSyncing) {
          this.syncingCourseId = null;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getStudentDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: GetStudentDashboardResponse) => {
          this.dashboardData = data;
          this.generateRecentActivities();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load dashboard data';
          this.isLoading = false;
          this.toasts.error('Unable to load dashboard. Please try again.');
        }
      });
  }

  loadAvailableCourses(): void {
    this.studentCourseService.getAvailableCourses(1, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.availableCourses = data;
        },
        error: (err) => {
          this.toasts.error('Unable to load available courses.');
        }
      });
  }

  async checkOfflineStatus(): Promise<void> {
    try {
      if (this.dashboardData) {
        const allEnrollments = [
          ...this.dashboardData.in_progress_courses,
          ...this.dashboardData.completed_courses,
          ...this.dashboardData.active_enrollments
        ];

        for (const enrollment of allEnrollments) {
          const isDownloaded = await this.studentCourseService.isCourseDownloadedForOffline(enrollment.course_id);
          if (isDownloaded) {
            this.downloadedCourses.add(enrollment.course_id);
          }
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

  async syncCourseProgress(enrollment: EnrollmentWithCourseAndProgressSummary, event: Event): Promise<void> {
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
      this.loadDashboard();

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      this.toasts.error(`Failed to sync progress: ${errorMessage}`);
    } finally {
      this.syncingCourseId = null;
    }
  }

  isSyncing(courseId: string): boolean {
    return this.syncingCourseId === courseId;
  }

  async downloadCourseForOffline(courseId: string, event: Event): Promise<void> {
    event.stopPropagation();

    if (this.isCourseDownloaded(courseId)) {
      this.toasts.info('This course is already downloaded for offline use.');
      return;
    }

    if (this.downloadingCourseId) {
      return;
    }

    const enrollment = [...this.getInProgressEnrollments(), ...this.getActiveEnrollments()]
      .find(e => e.course_id === courseId);
    const courseName = enrollment?.course.title || 'this course';

    const confirmed = confirm(
      `Download "${courseName}" for offline use?\n\n` +
      'This will download all course content and media files.'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.downloadingCourseId = courseId;
      this.toasts.info('Starting course download for offline access...');

      await this.studentCourseService.downloadCourseForOffline(courseId, 7);

      this.toasts.success('Course downloaded successfully! You can now access it offline.');
      this.downloadedCourses.add(courseId);

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

  generateRecentActivities(): void {
    if (!this.dashboardData) return;

    this.recentActivities = [];

    this.dashboardData.completed_courses.slice(0, 2).forEach(enrollment => {
      this.recentActivities.push({
        type: 'quiz',
        icon: 'fas fa-trophy',
        title: `Completed: ${enrollment.course.title}`,
        subtitle: 'Certificate earned',
        time: this.getTimeAgo(enrollment.completed_at || enrollment.enrolled_at)
      });
    });

    this.dashboardData.in_progress_courses.slice(0, 3).forEach(enrollment => {
      const progressPercent = enrollment.completion_percentage;
      this.recentActivities.push({
        type: 'module',
        icon: progressPercent > 0 ? 'fas fa-play-circle' : 'fas fa-book-open',
        title: progressPercent > 0 ? `Continuing: ${enrollment.course.title}` : `Started: ${enrollment.course.title}`,
        subtitle: `${progressPercent}% complete - ${enrollment.completed_modules}/${enrollment.total_modules} modules`,
        time: this.getTimeAgo(enrollment.last_accessed_at || enrollment.enrolled_at)
      });
    });

    this.recentActivities = this.recentActivities.slice(0, 5);
  }

  getTimeAgo(dateString: string | undefined): string {
    if (!dateString) return 'Recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getInProgressEnrollments(): EnrollmentWithCourseAndProgressSummary[] {
    return this.dashboardData?.in_progress_courses || [];
  }

  getCompletedEnrollments(): EnrollmentWithCourseAndProgressSummary[] {
    return this.dashboardData?.completed_courses || [];
  }

  getActiveEnrollments(): EnrollmentWithCourseAndProgressSummary[] {
    return this.dashboardData?.active_enrollments || [];
  }

  getActiveCoursesCount(): number {
    return this.dashboardData?.total_in_progress || 0;
  }

  getCompletedCoursesCount(): number {
    return this.dashboardData?.total_completed || 0;
  }

  getTotalCoursesCount(): number {
    return this.dashboardData?.total_courses || 0;
  }

  getAverageProgress(): number {
    const inProgress = this.getInProgressEnrollments();
    if (inProgress.length === 0) return 0;

    const total = inProgress.reduce(
      (sum, enrollment) => sum + (enrollment.completion_percentage || 0),
      0
    );

    return Math.round(total / inProgress.length);
  }

  getCertificatesEarned(): number {
    return this.getCompletedCoursesCount();
  }

  getContinueLearningItem(): EnrollmentWithCourseAndProgressSummary | null {
    if (this.dashboardData?.continue_learning) {
      return this.dashboardData.continue_learning;
    }

    const inProgress = this.getInProgressEnrollments();
    if (inProgress.length === 0) return null;

    return inProgress[0];
  }

  navigateToCatalog(): void {
    this.router.navigate(['/courses/catalogs']);
  }

  navigateToEnrollments(): void {
    this.router.navigate(['/courses/enrollments']);
  }

  navigateToCourseDetails(courseId: string): void {
    this.router.navigate(['/courses/details'], { queryParams: { id: courseId } });
  }

  navigateToCourseProgress(courseId: string): void {
    this.router.navigate(['/courses/details'], { queryParams: { id: courseId } });
  }

  navigateToModule(courseId: string, moduleId: string): void {
    this.router.navigate(['/courses/module/content'], {
      queryParams: { courseId, moduleId }
    });
  }

  enrollInCourse(courseId: string, event: Event): void {
    event.stopPropagation();

    this.studentCourseService.enrollInCourse(courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.toasts.success('Successfully enrolled in course!');
          this.loadDashboard();
          this.loadAvailableCourses();
        },
        error: (err) => {
          this.toasts.error('Failed to enroll in course. Please try again.');
        }
      });
  }

  continueCourseLearning(enrollment: EnrollmentWithCourseAndProgressSummary): void {
    if (enrollment.next_module_id) {
      this.navigateToModule(enrollment.course_id, enrollment.next_module_id);
    } else {
      this.navigateToCourseProgress(enrollment.course_id);
    }
  }

  viewCourseDetails(courseId: string): void {
    this.navigateToCourseDetails(courseId);
  }

  isCompleted(enrollment: EnrollmentWithCourseAndProgressSummary): boolean {
    return enrollment.status === 'completed' || !!enrollment.completed_at;
  }

  getProgressPercentage(enrollment: EnrollmentWithCourseAndProgressSummary): number {
    return enrollment.completion_percentage || 0;
  }

  getCompletedModules(enrollment: EnrollmentWithCourseAndProgressSummary): number {
    return enrollment.completed_modules || 0;
  }

  getTotalModules(enrollment: EnrollmentWithCourseAndProgressSummary): number {
    return enrollment.total_modules || 0;
  }
}
