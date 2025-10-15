import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';


// Strategy Service
import { DataStrategyService } from '../../../theme/shared/services/data-strategy.service';

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
  GetQuizQuestionsForOfflineResponse
} from '../models/learning-progress.dtos.interface';
import {CourseOnlineProvider} from '../providers/course-online.provider';
import {CourseOfflineProvider} from '../providers/course-offline.provider';

/**
 * Student Course Service - Clean business logic layer
 * Uses DataStrategyService for automatic online/offline handling
 * No more if/else offline checks!
 */
@Injectable({
  providedIn: 'root'
})
export class StudentCourseService {

  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private dataStrategy: DataStrategyService,
    private courseOnline: CourseOnlineProvider,
    private courseOffline: CourseOfflineProvider
  ) {}

  // ========== COURSE BROWSING & DISCOVERY ==========

  /**
   * Get all published courses with pagination
   */
  getPublishedCourses(page: number = 1, perPage: number = 20): Observable<GetAllCoursesResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetAllCoursesResponse>(
      'getPublishedCourses',
      this.courseOnline,
      this.courseOffline,
      [page, perPage],
      {
        saveToLocal: true,  // Cache courses for offline viewing
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get courses available for enrollment (meets prerequisites)
   */
  getAvailableCourses(page: number = 1, perPage: number = 20): Observable<GetAvailableCoursesResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetAvailableCoursesResponse>(
      'getAvailableCourses',
      this.courseOnline,
      this.courseOffline,
      [page, perPage],
      {
        saveToLocal: true,  // Cache available courses
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed information about a specific course
   */
  getCourseDetails(courseId: string): Observable<GetCourseResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetCourseResponse>(
      'getCourseDetails',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        saveToLocal: true,  // Cache course details
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get all modules in a course
   */
  getCourseModules(courseId: string): Observable<GetCourseModulesResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetCourseModulesResponse>(
      'getCourseModules',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        saveToLocal: true,  // Cache modules
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Check if student can enroll in a course
   */
  checkEnrollmentEligibility(courseId: string): Observable<CheckEnrollmentEligibilityResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<CheckEnrollmentEligibilityResponse>(
      'checkEnrollmentEligibility',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        readOnly: true  // No caching or sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== ENROLLMENT MANAGEMENT ==========

  /**
   * Get all enrollments for current student
   */
  getMyEnrollments(): Observable<GetStudentEnrollmentsResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetStudentEnrollmentsResponse>(
      'getMyEnrollments',
      this.courseOnline,
      this.courseOffline,
      [],
      {
        saveToLocal: true,  // Cache enrollments for offline access
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Enroll in a course
   * IMPORTANT: This downloads the entire course for offline use
   */
  enrollInCourse(courseId: string): Observable<EnrollInCourseResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<EnrollInCourseResponse>(
      'enrollInCourse',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        saveToLocal: true,        // Cache enrollment
        queueIfOffline: true,     // Sync when online
        downloadForOffline: true  // Download entire course content
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Unenroll from a course
   */
  unenrollFromCourse(courseId: string): Observable<UnenrollFromCourseResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<UnenrollFromCourseResponse>(
      'unenrollFromCourse',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        queueIfOffline: true  // Sync when online
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed enrollment information including progress
   */
  getEnrollmentDetails(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetEnrollmentDetailsResponse>(
      'getEnrollmentDetails',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        saveToLocal: true,  // Cache enrollment details
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== LEARNING & MODULE CONTENT ACCESS ==========

  /**
   * Get module content for learning
   */
  getModuleContent(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetModuleContentForStudentResponse>(
      'getModuleContent',
      this.courseOnline,
      this.courseOffline,
      [moduleId],
      {
        saveToLocal: true,  // Cache module content
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Mark module as started
   */
  startModule(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<MarkModuleAsStartedResponse>(
      'startModule',
      this.courseOnline,
      this.courseOffline,
      [moduleId],
      {
        saveToLocal: true,     // Cache progress
        queueIfOffline: true   // Sync when online
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Mark module as completed
   */
  completeModule(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<MarkModuleAsCompletedResponse>(
      'completeModule',
      this.courseOnline,
      this.courseOffline,
      [moduleId],
      {
        saveToLocal: true,     // Cache progress
        queueIfOffline: true   // Sync when online
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== QUIZ & EXAM MANAGEMENT ==========

  /**
   * Get questions for an existing quiz attempt (for resuming)
   */
  getAttemptQuestions(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetAttemptQuestionsResponse>(
      'getAttemptQuestions',
      this.courseOnline,
      this.courseOffline,
      [attemptId],
      {
        readOnly: true  // No caching or sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get all attempts for a quiz
   */
  getQuizAttempts(quizId: string): Observable<GetQuizAttemptsResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetQuizAttemptsResponse>(
      'getQuizAttempts',
      this.courseOnline,
      this.courseOffline,
      [quizId],
      {
        saveToLocal: true,  // Cache attempts
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get quiz questions for offline use
   */
  getQuizQuestions(quizId: string): Observable<GetQuizQuestionsForOfflineResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetQuizQuestionsForOfflineResponse>(
      'getQuizQuestions',
      this.courseOnline,
      this.courseOffline,
      [quizId],
      {
        saveToLocal: true,  // Cache questions for offline
        readOnly: true      // No sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Start a new quiz attempt
   */
  startQuiz(quizId: string): Observable<StartQuizAttemptResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<StartQuizAttemptResponse>(
      'startQuiz',
      this.courseOnline,
      this.courseOffline,
      [quizId],
      {
        saveToLocal: true,     // Cache attempt and questions
        queueIfOffline: true   // Sync when online
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Submit answer for a quiz question
   */
  submitQuizAnswer(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<SubmitQuizAnswerResponse>(
      'submitQuizAnswer',
      this.courseOnline,
      this.courseOffline,
      [attemptId, request],
      {
        saveToLocal: true,     // Cache answer
        queueIfOffline: true   // Sync when online
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Complete and submit quiz attempt
   */
  completeQuiz(attemptId: string): Observable<CompleteQuizAttemptResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<CompleteQuizAttemptResponse>(
      'completeQuiz',
      this.courseOnline,
      this.courseOffline,
      [attemptId],
      {
        saveToLocal: true,     // Cache final result
        queueIfOffline: true   // Sync when online
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed results of a quiz attempt
   */
  getQuizResults(attemptId: string): Observable<GetQuizResultsResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetQuizResultsResponse>(
      'getQuizResults',
      this.courseOnline,
      this.courseOffline,
      [attemptId],
      {
        readOnly: true  // No caching or sync needed
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== PROGRESS TRACKING & DASHBOARD ==========

  /**
   * Get student dashboard with all enrollments and progress
   */
  getStudentDashboard(): Observable<GetStudentDashboardResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetStudentDashboardResponse>(
      'getStudentDashboard',
      this.courseOnline,
      this.courseOffline,
      [],
      {
        readOnly: true  // No caching - dynamic data
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed progress for a specific course
   */
  getCourseProgress(courseId: string): Observable<GetCourseProgressResponse> {
    this.isLoadingSubject.next(true);

    return this.dataStrategy.execute<GetCourseProgressResponse>(
      'getCourseProgress',
      this.courseOnline,
      this.courseOffline,
      [courseId],
      {
        readOnly: true  // No caching - dynamic data
      }
    ).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== LOADING STATE ==========

  /**
   * Get loading status observable
   */
  isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }
}
