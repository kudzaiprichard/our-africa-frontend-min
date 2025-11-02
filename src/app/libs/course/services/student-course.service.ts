// src/app/libs/course/services/student-course.service.ts

import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

// Course Management DTOs
import {
  GetAllCoursesResponse,
  GetCourseResponse,
  GetCourseModulesResponse
} from '../models/course-management.dtos.interface';

// Enrollment DTOs
import {
  EnrollInCourseResponse,
  UnenrollFromCourseResponse,
  GetStudentEnrollmentsResponse,
  GetEnrollmentDetailsResponse,
  CheckEnrollmentEligibilityResponse,
  GetAvailableCoursesResponse
} from '../models/enrollment.dtos.interface';

// Learning Progress DTOs
import {
  GetModuleContentForStudentResponse,
  MarkModuleAsStartedResponse,
  MarkModuleAsCompletedResponse,
  GetQuizAttemptsResponse,
  StartQuizAttemptResponse,
  SubmitQuizAnswerRequest,
  SubmitQuizAnswerResponse,
  CompleteQuizAttemptResponse,
  GetQuizResultsResponse,
  GetStudentDashboardResponse,
  GetCourseProgressResponse,
  GetAttemptQuestionsResponse,
  GetQuizQuestionsForOfflineResponse,
  MarkContentAsViewedResponse,
  MarkContentAsCompletedResponse,
  GetModuleResumeDataResponse
} from '../models/learning-progress.dtos.interface';

// Offline Learning DTOs
import {
  DownloadCourseForOfflineResponse,
  SyncOfflineProgressResponse,
  ValidateOfflineSessionResponse,
  MyOfflineSessionsResponse
} from '../models/offline-learning.dtos.interface';
import { OfflineDownloadService } from './offline-download.service';
import { CourseProvider } from '../providers/course.provider';
import {ToastsService} from '../../../theme/shared';

/**
 * Student Course Service
 * Clean business logic layer that delegates to providers
 *
 * Architecture:
 * - Regular operations → CourseProvider (handles online/offline internally)
 * - Download/Sync operations → OfflineDownloadService (explicit user actions)
 *
 * Key Principle: Simple delegation pattern, no complex logic here
 */
@Injectable({
  providedIn: 'root'
})
export class StudentCourseService {

  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private courseProvider: CourseProvider,
    private offlineDownload: OfflineDownloadService,
    private toasts: ToastsService
  ) {}

  // ============================================================================
  // COURSE BROWSING & DISCOVERY
  // ============================================================================

  getPublishedCourses(page: number = 1, perPage: number = 20): Observable<GetAllCoursesResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getPublishedCourses(page, perPage).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getAvailableCourses(page: number = 1, perPage: number = 20): Observable<GetAvailableCoursesResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getAvailableCourses(page, perPage).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getCourseDetails(courseId: string): Observable<GetCourseResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getCourseDetails(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getCourseModules(courseId: string): Observable<GetCourseModulesResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getCourseModules(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  checkEnrollmentEligibility(courseId: string): Observable<CheckEnrollmentEligibilityResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.checkEnrollmentEligibility(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // ENROLLMENT MANAGEMENT
  // ============================================================================

  getMyEnrollments(): Observable<GetStudentEnrollmentsResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getMyEnrollments().pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  enrollInCourse(courseId: string): Observable<EnrollInCourseResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.enrollInCourse(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  unenrollFromCourse(courseId: string): Observable<UnenrollFromCourseResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.unenrollFromCourse(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getEnrollmentDetails(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getEnrollmentDetails(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // LEARNING & MODULE CONTENT ACCESS
  // ============================================================================

  getModuleContent(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getModuleContent(moduleId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  startModule(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.startModule(moduleId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  completeModule(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.completeModule(moduleId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // QUIZ & EXAM MANAGEMENT
  // ============================================================================

  getAttemptQuestions(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getAttemptQuestions(attemptId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getQuizAttempts(quizId: string): Observable<GetQuizAttemptsResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getQuizAttempts(quizId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getQuizQuestions(quizId: string): Observable<GetQuizQuestionsForOfflineResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getQuizQuestions(quizId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  startQuiz(quizId: string): Observable<StartQuizAttemptResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.startQuiz(quizId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  submitQuizAnswer(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.submitQuizAnswer(attemptId, request).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  completeQuiz(attemptId: string, forceSubmit: boolean = false): Observable<CompleteQuizAttemptResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.completeQuiz(attemptId, forceSubmit).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  abandonQuiz(attemptId: string): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.abandonQuiz(attemptId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getQuizResults(attemptId: string): Observable<GetQuizResultsResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getQuizResults(attemptId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // PROGRESS TRACKING & DASHBOARD
  // ============================================================================

  getStudentDashboard(): Observable<GetStudentDashboardResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getStudentDashboard().pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getCourseProgress(courseId: string): Observable<GetCourseProgressResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getCourseProgress(courseId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // CONTENT PROGRESS TRACKING
  // ============================================================================

  markContentAsViewed(contentId: string): Observable<MarkContentAsViewedResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.markContentAsViewed(contentId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  markContentAsCompleted(contentId: string): Observable<MarkContentAsCompletedResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.markContentAsCompleted(contentId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getModuleResumeData(moduleId: string): Observable<GetModuleResumeDataResponse> {
    this.isLoadingSubject.next(true);
    return this.courseProvider.getModuleResumeData(moduleId).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ============================================================================
  // OFFLINE LEARNING (Explicit User Actions)
  // ============================================================================

  /**
   * Download course for offline use (explicit user action)
   * Downloads complete course package including all content and media files
   * Shows unified progress for both structure and media downloads
   */
  async downloadCourseForOffline(
    courseId: string,
    presignedUrlExpiryDays: number = 7
  ): Promise<DownloadCourseForOfflineResponse> {
    this.isLoadingSubject.next(true);

    try {
      this.toasts.info('Starting course download for offline access...');
      return await this.offlineDownload.downloadCourseForOffline(
        courseId,
        presignedUrlExpiryDays
      );
    } catch (error) {
      this.toasts.error('Unable to download course for offline use.');
      throw error;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Sync offline progress back to server (explicit user action)
   */
  async syncOfflineProgress(
    courseId: string,
    sessionId: string,
    progressData: any
  ): Promise<SyncOfflineProgressResponse> {
    this.isLoadingSubject.next(true);

    try {
      this.toasts.info('Syncing your progress...');
      const result = await this.offlineDownload.syncOfflineProgress(
        courseId,
        sessionId,
        progressData
      );
      this.toasts.success('Progress synced successfully!');
      return result;
    } catch (error) {
      this.toasts.error('Unable to sync your progress. Please try again.');
      throw error;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Validate offline session
   */
  async validateOfflineSession(
    sessionId: string,
    courseId: string
  ): Promise<ValidateOfflineSessionResponse> {
    try {
      return await this.offlineDownload.validateSession(sessionId, courseId);
    } catch (error) {
      this.toasts.error('Unable to validate offline session.');
      throw error;
    }
  }

  /**
   * Get my offline sessions
   */
  async getMyOfflineSessions(
    courseId?: string,
    activeOnly: boolean = false
  ): Promise<MyOfflineSessionsResponse> {
    try {
      return await this.offlineDownload.getMySessions(courseId, activeOnly);
    } catch (error) {
      this.toasts.error('Unable to load offline sessions.');
      throw error;
    }
  }

  /**
   * Delete offline session (explicit user action)
   */
  async deleteOfflineSession(sessionId: string): Promise<void> {
    this.isLoadingSubject.next(true);
    try {
      await this.offlineDownload.deleteSession(sessionId);
      this.toasts.success('Offline session deleted.');
    } catch (error) {
      this.toasts.error('Unable to delete offline session.');
      throw error;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Delete offline session with all media (explicit user action)
   */
  async deleteOfflineSessionWithMedia(sessionId: string, courseId: string): Promise<void> {
    this.isLoadingSubject.next(true);
    try {
      await this.offlineDownload.deleteSessionWithData(sessionId, courseId);
      this.toasts.success('Offline session and downloaded content deleted.');
    } catch (error) {
      this.toasts.error('Unable to delete offline session and content.');
      throw error;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Check if course is downloaded for offline
   */
  async isCourseDownloadedForOffline(courseId: string): Promise<boolean> {
    try {
      return await this.offlineDownload.isCourseDownloaded(courseId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get unified download progress observable
   * Includes both course structure and media download progress in a single stream
   *
   * Progress object structure:
   * {
   *   courseId: string | null,
   *   status: 'idle' | 'downloading' | 'completed' | 'error',
   *   phase: 'idle' | 'fetching' | 'saving_structure' | 'downloading_media' | 'verifying' | 'completed' | 'error',
   *   totalSteps: number,
   *   completedSteps: number,
   *   currentStep: string,
   *   percentage: number (0-100),
   *   mediaProgress: {
   *     totalFiles: number,
   *     downloadedFiles: number,
   *     failedFiles: number,
   *     currentFile: string | null,
   *     currentFileProgress: number (0-100)
   *   }
   * }
   */
  getDownloadProgress$(): Observable<any> {
    return this.offlineDownload.downloadProgress$;
  }

  /**
   * Cancel ongoing download (explicit user action)
   */
  cancelDownload(): void {
    this.offlineDownload.cancelDownload();
    this.toasts.info('Download cancelled.');
  }

  /**
   * Get offline session statistics
   */
  async getOfflineStatistics(): Promise<any> {
    try {
      return await this.offlineDownload.getSessionStatistics();
    } catch (error) {
      this.toasts.error('Unable to load offline statistics.');
      throw error;
    }
  }

  // ============================================================================
  // MEDIA CACHE UTILITIES
  // ============================================================================

  /**
   * Get cached media files for a course
   */
  async getCachedMedia(courseId: string): Promise<any[]> {
    try {
      return await this.offlineDownload.getCachedMedia(courseId);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get local file path for a media file
   * Returns null if media is not downloaded
   */
  async getLocalMediaPath(mediaId: string): Promise<string | null> {
    try {
      return await this.offlineDownload.getLocalFilePath(mediaId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if specific media file is downloaded
   */
  async isMediaDownloaded(mediaId: string): Promise<boolean> {
    try {
      return await this.offlineDownload.isMediaDownloaded(mediaId);
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  /**
   * Get loading status observable
   */
  isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }
}
