// src/app/pages/courses/course-details/course-details.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StudentCourseService } from '../../../libs/course';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';
import { ToastsService } from '../../../theme/shared';
import {
  CheckEnrollmentEligibilityResponse
} from '../../../libs/course';
import {
  CourseFull,
  ModuleBasic,
  QuizBasic
} from '../../../libs/course';

@Component({
  selector: 'app-course-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.scss'
})
export class CourseDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  courseId: string = '';
  course: CourseFull | null = null;
  finalExam: QuizBasic | null = null;
  modules: ModuleBasic[] = [];
  eligibility: CheckEnrollmentEligibilityResponse | null = null;

  isLoading = false;
  error: string | null = null;
  isOffline = false;
  isEnrolledInCourse = false;
  isCheckingEnrollment = false;

  expandedModules = new Set<string>();

  isDownloading = false;
  downloadProgress = 0;
  downloadCurrentStep = '';
  downloadPhase = '';
  isCourseDownloaded = false;
  isCheckingDownloadStatus = false;

  mediaDownloadInfo = {
    totalFiles: 0,
    downloadedFiles: 0,
    currentFile: null as string | null
  };

  Math = Math;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private studentCourseService: StudentCourseService,
    private connectivity: ConnectivityService,
    private toasts: ToastsService
  ) {}

  ngOnInit(): void {
    this.isOffline = this.connectivity.isOffline();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.courseId = params['id'];
        if (this.courseId) {
          this.loadAllData();
          this.checkIfCourseDownloaded();
          this.checkEnrollmentStatus();
        } else {
          this.error = 'No course ID provided';
          this.toasts.error('No course ID provided.');
        }
      });

    this.studentCourseService.getDownloadProgress$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress: any) => {
        this.isDownloading = progress.status === 'downloading';
        this.downloadProgress = progress.percentage || 0;
        this.downloadCurrentStep = progress.currentStep || '';
        this.downloadPhase = progress.phase || '';

        if (progress.mediaProgress) {
          this.mediaDownloadInfo = {
            totalFiles: progress.mediaProgress.totalFiles || 0,
            downloadedFiles: progress.mediaProgress.downloadedFiles || 0,
            currentFile: progress.mediaProgress.currentFile || null
          };

          if (progress.phase === 'downloading_media' && this.mediaDownloadInfo.totalFiles > 0) {
            this.downloadCurrentStep =
              `Downloading media: ${this.mediaDownloadInfo.downloadedFiles}/${this.mediaDownloadInfo.totalFiles} files`;

            if (this.mediaDownloadInfo.currentFile) {
              this.downloadCurrentStep += ` (${this.mediaDownloadInfo.currentFile})`;
            }
          }
        }

        if (progress.status === 'completed') {
          setTimeout(() => {
            this.checkIfCourseDownloaded();
            this.isDownloading = false;
            this.downloadProgress = 0;
            this.downloadCurrentStep = '';
            this.downloadPhase = '';
            this.mediaDownloadInfo = {
              totalFiles: 0,
              downloadedFiles: 0,
              currentFile: null
            };
          }, 1000);
        }

        if (progress.status === 'error') {
          this.isDownloading = false;
          this.downloadProgress = 0;
          this.downloadCurrentStep = '';
          this.downloadPhase = '';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllData(): void {
    this.isLoading = true;
    this.error = null;

    this.isOffline = this.connectivity.isOffline();

    const requests: {
      courseDetails: any;
      modules: any;
      eligibility?: any;
    } = {
      courseDetails: this.studentCourseService.getCourseDetails(this.courseId),
      modules: this.studentCourseService.getCourseModules(this.courseId)
    };

    if (!this.isOffline) {
      requests.eligibility = this.studentCourseService.checkEnrollmentEligibility(this.courseId)
        .pipe(
          catchError((error: any) => {
            return of(null);
          })
        );
    }

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (responses: any) => {
          this.course = responses.courseDetails.course;
          this.finalExam = responses.courseDetails.final_exam || null;
          this.modules = responses.modules.modules;
          this.eligibility = responses.eligibility || null;
          this.isLoading = false;
        },
        error: (err: any) => {
          this.error = 'Failed to load course details';
          this.isLoading = false;
          this.toasts.error('Unable to load course details. Please try again.');
        }
      });
  }

  async checkEnrollmentStatus(): Promise<void> {
    this.isCheckingEnrollment = true;

    try {
      const enrollmentDetails = await this.studentCourseService
        .getEnrollmentDetails(this.courseId)
        .toPromise();

      if (enrollmentDetails && enrollmentDetails.enrollment) {
        this.isEnrolledInCourse = true;
      } else {
        this.isEnrolledInCourse = false;
      }
    } catch (error) {
      this.isEnrolledInCourse = false;
    } finally {
      this.isCheckingEnrollment = false;
    }
  }

  async checkIfCourseDownloaded(): Promise<void> {
    this.isCheckingDownloadStatus = true;
    try {
      this.isCourseDownloaded = await this.studentCourseService.isCourseDownloadedForOffline(this.courseId);
    } catch (error) {
      this.isCourseDownloaded = false;
      this.toasts.error('Unable to check download status.');
    } finally {
      this.isCheckingDownloadStatus = false;
    }
  }

  async downloadCourseForOffline(): Promise<void> {
    this.isOffline = this.connectivity.isOffline();

    if (this.isOffline) {
      this.toasts.warning('You must be online to download courses for offline use.');
      return;
    }

    if (!this.isEnrolled()) {
      this.toasts.warning('You must be enrolled in this course to download it for offline use.');
      return;
    }

    if (this.isDownloading) {
      return;
    }

    const confirmed = confirm(
      'This will download the entire course content for offline use.\n\n' +
      'The download includes:\n' +
      '• All course modules and content\n' +
      '• Quiz questions\n' +
      '• Media files (videos, images, documents)\n\n' +
      'This may take a few minutes and use significant storage space.\n\n' +
      'Continue?'
    );

    if (!confirmed) {
      return;
    }

    try {
      this.toasts.info('Starting course download for offline access...');

      const response = await this.studentCourseService.downloadCourseForOffline(
        this.courseId,
        7
      );

      this.toasts.success('Course downloaded successfully! You can now access this course offline.');

      await this.checkIfCourseDownloaded();

    } catch (error: any) {
      const errorMessage = error.message || error.error?.message || 'Unknown error occurred';
      this.toasts.error(`Failed to download course: ${errorMessage}`);

      this.isDownloading = false;
      this.downloadProgress = 0;
      this.downloadCurrentStep = '';
      this.downloadPhase = '';
    }
  }

  cancelDownload(): void {
    if (!this.isDownloading) {
      return;
    }

    const confirmed = confirm('Are you sure you want to cancel the download?');
    if (confirmed) {
      this.studentCourseService.cancelDownload();
      this.toasts.info('Download cancelled.');
      this.isDownloading = false;
      this.downloadProgress = 0;
      this.downloadCurrentStep = '';
      this.downloadPhase = '';
      this.mediaDownloadInfo = {
        totalFiles: 0,
        downloadedFiles: 0,
        currentFile: null
      };
    }
  }

  getDownloadStatusText(): string {
    if (this.downloadCurrentStep) {
      return this.downloadCurrentStep;
    }
    if (this.isDownloading && this.downloadProgress > 0) {
      return `Downloading... ${Math.round(this.downloadProgress)}%`;
    }
    if (this.isDownloading) {
      return 'Preparing download...';
    }
    return 'Download for Offline';
  }

  getDownloadPhaseText(): string {
    switch (this.downloadPhase) {
      case 'fetching':
        return 'Fetching course package...';
      case 'saving_structure':
        return 'Saving course structure...';
      case 'downloading_media':
        return 'Downloading media files...';
      case 'verifying':
        return 'Verifying download...';
      case 'completed':
        return 'Download complete!';
      default:
        return '';
    }
  }

  toggleModule(moduleId: string): void {
    if (this.expandedModules.has(moduleId)) {
      this.expandedModules.delete(moduleId);
    } else {
      this.expandedModules.add(moduleId);
    }
  }

  isModuleExpanded(moduleId: string): boolean {
    return this.expandedModules.has(moduleId);
  }

  enrollInCourse(): void {
    this.isOffline = this.connectivity.isOffline();

    if (this.isOffline) {
      this.toasts.warning('You must be online to enroll in courses.');
      return;
    }

    if (!this.canEnroll()) {
      return;
    }

    this.studentCourseService.enrollInCourse(this.courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.toasts.success('Successfully enrolled! You can now start learning.');

          this.loadAllData();
          this.checkIfCourseDownloaded();
          this.checkEnrollmentStatus();
        },
        error: (err) => {
          this.error = 'Failed to enroll in course';
          const errorMessage = err.error?.message || err.message || 'Unknown error';
          this.toasts.error(`Failed to enroll: ${errorMessage}`);
        }
      });
  }

  viewModuleContent(moduleId: string): void {
    this.router.navigate(['/courses/module/content'], {
      queryParams: { moduleId: moduleId, courseId: this.courseId }
    });
  }

  shareCourse(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: this.course?.title || 'Course',
        text: this.course?.description || 'Check out this course!',
        url: url
      }).catch(err => {
        this.toasts.error('Unable to share course.');
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.toasts.success('Course link copied to clipboard!');
      }).catch(() => {
        this.toasts.error('Unable to copy link to clipboard.');
      });
    }
  }

  canEnroll(): boolean {
    if (this.isEnrolledInCourse) {
      return false;
    }

    if (this.isOffline) {
      return false;
    }

    return this.eligibility?.eligible === true;
  }

  isEnrolled(): boolean {
    return this.isEnrolledInCourse;
  }

  getEstimatedDuration(moduleCount: number): string {
    const hours = moduleCount * 3;
    return `${hours} Hours`;
  }

  getCourseCategory(): string {
    return this.course?.category || 'General';
  }

  getCourseRating(): string {
    return '4.8/5.0';
  }

  getEnrolledStudents(): string {
    return this.course?.enrollment_count?.toLocaleString() || '0';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  }

  getModuleDuration(contentCount: number): string {
    const hours = contentCount * 0.5;
    return `${hours.toFixed(1)} hours`;
  }

  goBack(): void {
    this.router.navigate(['/courses/catalogs']);
  }
}
