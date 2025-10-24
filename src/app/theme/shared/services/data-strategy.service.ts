import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { ConnectivityService } from './connectivity.service';
import { TauriDatabaseService } from './tauri-database.service';
import { OfflineSyncService } from './offline-sync.service';

/**
 * Data Strategy Service - Intelligently switches between online and offline providers
 * Handles caching, sync queue, and error recovery
 *
 * This service eliminates the need for if/else offline checks in business logic
 */
@Injectable({
  providedIn: 'root'
})
export class DataStrategyService {

  constructor(
    private connectivityService: ConnectivityService,
    private tauriDb: TauriDatabaseService,
    private offlineSync: OfflineSyncService
  ) {}

  /**
   * Execute operation with automatic online/offline handling
   *
   * @param operation - Method name to call on provider
   * @param onlineProvider - Provider to use when online
   * @param offlineProvider - Provider to use when offline
   * @param params - Array of parameters to pass to the method
   * @param options - Configuration options for the operation
   */
  execute<T>(
    operation: string,
    onlineProvider: any,
    offlineProvider: any,
    params: any[],
    options?: DataStrategyOptions
  ): Observable<T> {
    const defaultOptions: DataStrategyOptions = {
      saveToLocal: false,
      queueIfOffline: false,
      downloadForOffline: false,
      readOnly: false,
      cacheFirst: false,
      ...options
    };

    // Determine which provider to use
    const isOffline = this.connectivityService.isOffline();
    const provider = isOffline ? offlineProvider : onlineProvider;

    console.log(`🎯 DataStrategy.execute: ${operation} (${isOffline ? 'OFFLINE' : 'ONLINE'})`);

    // Execute the operation
    return provider[operation](...params).pipe(
      // Handle post-execution tasks (caching, downloading, syncing)
      switchMap((result: T) => this.handlePostExecution(
        result,
        operation,
        params,
        defaultOptions,
        isOffline,
        onlineProvider
      )),
      // Handle errors with fallback logic
      catchError(error => this.handleError(
        error,
        operation,
        offlineProvider,
        params,
        isOffline
      ))
    );
  }

  /**
   * Handle post-execution tasks based on options
   */
  private handlePostExecution<T>(
    result: T,
    operation: string,
    params: any[],
    options: DataStrategyOptions,
    isOffline: boolean,
    onlineProvider: any
  ): Observable<T> {
    return from(
      (async () => {
        // ONLINE PATH: Save to local DB and/or download for offline
        if (!isOffline) {
          // Save result to local database (for future offline use)
          if (options.saveToLocal) {
            await this.saveResultToLocal(operation, result, params);
          }

          // Download entire course content for offline use (enrollment only)
          if (options.downloadForOffline && operation === 'enrollInCourse') {
            // ✅ FIXED: Extract enrollment data from result
            const enrollmentResult = result as any;
            if (enrollmentResult.enrollment) {
              await this.downloadCourseForOffline(
                enrollmentResult.enrollment.course_id,  // courseId
                onlineProvider,                          // provider
                enrollmentResult.enrollment              // ✅ Pass enrollment to save AFTER course
              );
            }
          }
        }

        // OFFLINE PATH: Queue for sync when connection restored
        if (isOffline && options.queueIfOffline) {
          console.log(`📤 Queuing ${operation} for sync`);
          // Note: Actual queuing happens in offline provider
        }

        return result;
      })()
    );
  }

  /**
   * Handle errors with intelligent fallback
   */
  private handleError(
    error: any,
    operation: string,
    offlineProvider: any,
    params: any[],
    wasOffline: boolean
  ): Observable<any> {
    console.error(`❌ DataStrategy error in ${operation}:`, error);

    // If we were online but got a network error, try offline fallback
    if (!wasOffline && this.isNetworkError(error)) {
      console.log(`🔄 Network error detected, attempting offline fallback for ${operation}`);

      // Only fallback for READ operations (safe operations)
      const readOperations = [
        'getPublishedCourses',
        'getCourseDetails',
        'getCourseModules',
        'getMyEnrollments',
        'getEnrollmentDetails',
        'getModuleContent',
        'getQuizAttempts',
        'getQuizQuestions',
        'getAttemptQuestions',
        'getQuizResults',
        'getStudentDashboard',
        'getCourseProgress'
      ];

      if (readOperations.includes(operation)) {
        return offlineProvider[operation](...params).pipe(
          tap(() => console.log(`✅ Offline fallback succeeded for ${operation}`)),
          catchError(fallbackError => {
            console.error(`❌ Offline fallback also failed for ${operation}:`, fallbackError);
            return throwError(() => error); // Return original error
          })
        );
      }
    }

    return throwError(() => error);
  }

  /**
   * Save operation result to local database
   */
  private async saveResultToLocal(operation: string, result: any, params: any[]): Promise<void> {
    try {
      console.log(`💾 Saving ${operation} result to local database`);

      switch (operation) {
        case 'getPublishedCourses':
        case 'getAvailableCourses':
          if (result.courses && result.courses.length > 0) {
            await this.tauriDb.saveCoursesBulk(result.courses);
          }
          break;

        case 'getCourseDetails':
          if (result.course) {
            await this.tauriDb.saveCourse(result.course);
          }
          break;

        case 'getCourseModules':
          if (result.modules && result.modules.length > 0) {
            await this.tauriDb.saveModulesBulk(result.modules);
          }
          break;

        case 'getMyEnrollments':
          if (result.enrollments && result.enrollments.length > 0) {
            for (const enrollment of result.enrollments) {
              await this.tauriDb.saveEnrollment(enrollment);
              if (enrollment.course) {
                await this.tauriDb.saveCourse(enrollment.course);
              }
            }
          }
          break;

        case 'enrollInCourse':
          // ✅ DON'T save enrollment here - it will be saved during downloadCourseForOffline
          // to avoid FOREIGN KEY constraint failure (course must exist first)
          console.log('ℹ️ Enrollment will be saved after course download completes');
          break;

        case 'getModuleContent':
          if (result.module) {
            await this.tauriDb.saveModule(result.module);
          }
          if (result.content && result.content.length > 0) {
            await this.tauriDb.saveContentBlocksBulk(result.content);
          }
          if (result.quiz) {
            await this.tauriDb.saveQuiz(result.quiz);
          }
          break;

        case 'startModule':
        case 'completeModule':
          if (result.progress) {
            await this.tauriDb.saveModuleProgress(result.progress);
          }
          break;

        // ADDED: Content progress tracking
        case 'markContentAsViewed':
        case 'markContentAsCompleted':
          if (result.progress) {
            await this.tauriDb.saveContentProgress(result.progress);
          }
          break;

        case 'startQuiz':
          if (result.attempt) {
            await this.tauriDb.saveQuizAttempt(result.attempt);
          }
          if (result.quiz) {
            await this.tauriDb.saveQuiz(result.quiz);
          }
          if (result.questions && result.questions.length > 0) {
            await this.tauriDb.saveQuestionsBulk(result.questions);
          }
          break;

        case 'submitQuizAnswer':
          if (result.answer) {
            await this.tauriDb.saveQuizAnswer(result.answer);
          }
          break;

        default:
          console.log(`ℹ️ No local save logic for operation: ${operation}`);
      }

      console.log(`✅ ${operation} result saved to local database`);
    } catch (error) {
      console.error(`❌ Failed to save ${operation} result locally:`, error);
      // Don't throw - saving locally is optional
    }
  }

  /**
   * Download entire course content for offline use
   * Called after successful enrollment
   */
  private async downloadCourseForOffline(courseId: string, onlineProvider: any, enrollmentData?: any): Promise<void> {
    console.log(`📥 Starting download of course ${courseId} for offline use...`);

    try {
      // 1. Get course details AND final exam
      const courseResponse = await onlineProvider.getCourseDetails(courseId).toPromise();

      if (courseResponse.course) {
        const course = courseResponse.course;

        // Ensure level is valid
        const validLevels = ['beginner', 'intermediate', 'advanced'];
        if (!validLevels.includes(course.level)) {
          console.warn('⚠️ Invalid course level:', course.level, '- setting to beginner');
          course.level = 'beginner';
        }

        // ✅ FIRST: Save the course (must exist before enrollment due to foreign key)
        await this.tauriDb.saveCourse(course);
        console.log('✅ Course saved');
      }

      // ✅ NOW: Save enrollment if provided (course exists now, so foreign key won't fail)
      if (enrollmentData) {
        await this.tauriDb.saveEnrollment(enrollmentData);
        console.log('✅ Enrollment saved to local database');
      }

      // ✅ CRITICAL: Save final exam if present
      if (courseResponse.final_exam) {
        await this.tauriDb.saveQuiz(courseResponse.final_exam);
        console.log(`✅ Final exam saved: ${courseResponse.final_exam.title}`);

        // Download final exam questions
        try {
          const examQuestionsResponse = await onlineProvider.getQuizQuestions(courseResponse.final_exam.id).toPromise();
          if (examQuestionsResponse.questions && examQuestionsResponse.questions.length > 0) {
            await this.tauriDb.saveQuestionsBulk(examQuestionsResponse.questions);
            console.log(`✅ Saved ${examQuestionsResponse.questions.length} final exam questions`);
          }
        } catch (questionsError) {
          console.warn(`⚠️ Could not fetch final exam questions:`, questionsError);
        }
      } else {
        console.log('ℹ️ No final exam for this course');
      }

      // 2. Get all modules
      const modulesResponse = await onlineProvider.getCourseModules(courseId).toPromise();
      const modules = modulesResponse.modules || [];

      if (modules.length > 0) {
        await this.tauriDb.saveModulesBulk(modules);
        console.log(`✅ ${modules.length} modules saved`);
      }

      // 3. For each module, download content and quizzes
      for (const module of modules) {
        try {
          console.log(`📝 Downloading content for module: ${module.title}`);

          // Get module content
          const contentResponse = await onlineProvider.getModuleContent(module.id).toPromise();

          // Save module
          if (contentResponse.module) {
            await this.tauriDb.saveModule(contentResponse.module);
          }

          // Save content blocks
          if (contentResponse.content && contentResponse.content.length > 0) {
            await this.tauriDb.saveContentBlocksBulk(contentResponse.content);
            console.log(`  ✅ Saved ${contentResponse.content.length} content blocks`);
          }

          // Save quiz and questions
          if (contentResponse.quiz) {
            await this.tauriDb.saveQuiz(contentResponse.quiz);
            console.log(`  ✅ Saved quiz: ${contentResponse.quiz.title}`);

            // Get quiz questions for offline use
            try {
              let questions = contentResponse.questions;

              // If questions not included in module content, fetch separately
              if (!questions || questions.length === 0) {
                console.log(`  📝 Fetching quiz questions separately...`);
                const questionsResponse = await onlineProvider.getQuizQuestions(contentResponse.quiz.id).toPromise();

                if (questionsResponse.questions) {
                  questions = questionsResponse.questions;
                }
              }

              // Save questions
              if (questions && questions.length > 0) {
                await this.tauriDb.saveQuestionsBulk(questions);
                console.log(`  ✅ Saved ${questions.length} quiz questions`);
              }
            } catch (questionsError) {
              console.warn(`  ⚠️ Could not fetch quiz questions for offline use:`, questionsError);
              // Continue - quiz metadata is saved, questions can be fetched later
            }
          }
        } catch (moduleError) {
          console.error(`❌ Failed to download content for module ${module.id}:`, moduleError);
          // Continue with other modules
        }
      }

      console.log(`✅ Course ${courseId} fully downloaded for offline use (including final exam)`);
    } catch (error) {
      console.error(`❌ Failed to download course for offline:`, error);
      throw error;
    }
  }
  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    // Check for common network error indicators
    return (
      !navigator.onLine ||
      error.status === 0 ||
      error.status === 504 ||
      error.name === 'TimeoutError' ||
      error.message?.includes('Network') ||
      error.message?.includes('offline')
    );
  }

  /**
   * Synchronous check if system is online (with backend health check)
   * Use this for critical operations that need fresh status
   */
  async isOnlineSync(): Promise<boolean> {
    return this.connectivityService.isOnlineSync();
  }

  /**
   * Get current online/offline status (cached)
   */
  isOnline(): boolean {
    return this.connectivityService.isOnline();
  }

  /**
   * Get online status as observable
   */
  onlineStatus$(): Observable<boolean> {
    return this.connectivityService.getOnlineStatus();
  }

  /**
   * Manually trigger sync of queued operations
   */
  async syncQueuedOperations(): Promise<void> {
    if (this.connectivityService.isOffline()) {
      console.log('📵 Cannot sync while offline');
      return;
    }

    console.log('🔄 Manually triggering sync...');
    await this.offlineSync.syncAll();
  }

  /**
   * Get count of operations waiting to sync
   */
  async getPendingSyncCount(): Promise<number> {
    return this.offlineSync.getSyncQueueCount();
  }
}

/**
 * Configuration options for execute() method
 */
export interface DataStrategyOptions {
  /**
   * Save result to local database (for future offline use)
   * Default: false
   */
  saveToLocal?: boolean;

  /**
   * Queue operation for sync when connection restored (for write operations done offline)
   * Default: false
   */
  queueIfOffline?: boolean;

  /**
   * Download entire course content for offline use (enrollment only)
   * Default: false
   */
  downloadForOffline?: boolean;

  /**
   * Operation is read-only (no sync needed)
   * Default: false
   */
  readOnly?: boolean;

  /**
   * Use cache-first strategy (check local DB before API)
   * Default: false
   */
  cacheFirst?: boolean;
}
