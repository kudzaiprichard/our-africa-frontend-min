import { Injectable } from '@angular/core';
import {Observable, BehaviorSubject, throwError, from} from 'rxjs';
import { tap, map, catchError, finalize } from 'rxjs/operators';
import { API_ENDPOINTS, BaseHttpService } from '../../core';
import { HttpParams } from '@angular/common/http';

// Course Management DTOs
import {
  GetAllCoursesResponse,
  GetCourseResponse,
  GetCourseModulesResponse
} from '../models/course-management.dtos.interface';

// Enrollment DTOs
import {
  EnrollInCourseRequest,
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
  MarkModuleAsStartedRequest,
  MarkModuleAsStartedResponse,
  MarkModuleAsCompletedRequest,
  MarkModuleAsCompletedResponse,
  GetQuizAttemptsResponse,
  StartQuizAttemptRequest,
  StartQuizAttemptResponse,
  SubmitQuizAnswerRequest,
  SubmitQuizAnswerResponse,
  CompleteQuizAttemptRequest,
  CompleteQuizAttemptResponse,
  GetQuizResultsResponse,
  GetStudentDashboardResponse,
  GetCourseProgressResponse,
  GetAttemptQuestionsResponse
} from '../models/learning-progress.dtos.interface';
import {ConnectivityService} from '../../../theme/shared/services/connectivity.service';
import {TauriDatabaseService} from '../../../theme/shared/services/tauri-database.service';

@Injectable({
  providedIn: 'root'
})
export class StudentCourseService {

  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private baseHttpService: BaseHttpService,
    private connectivityService: ConnectivityService,
    private tauriDb: TauriDatabaseService
  ) {}

  // ========== COURSE BROWSING & DISCOVERY ==========

  /**
   * Get all published courses with pagination
   */
  getPublishedCourses(page: number = 1, perPage: number = 20): Observable<GetAllCoursesResponse> {
    this.isLoadingSubject.next(true);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.baseHttpService.get<GetAllCoursesResponse>(
      API_ENDPOINTS.STUDENT.COURSES,
      params
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get published courses failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get courses available for enrollment (meets prerequisites)
   */
  getAvailableCourses(page: number = 1, perPage: number = 20): Observable<GetAvailableCoursesResponse> {
    this.isLoadingSubject.next(true);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.baseHttpService.get<GetAvailableCoursesResponse>(
      API_ENDPOINTS.STUDENT.COURSES_AVAILABLE,
      params
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get available courses failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed information about a specific course
   */
  getCourseDetails(courseId: string): Observable<GetCourseResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetCourseResponse>(
      API_ENDPOINTS.STUDENT.COURSE_DETAILS(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get course details failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get all modules in a course
   */
  getCourseModules(courseId: string): Observable<GetCourseModulesResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetCourseModulesResponse>(
      API_ENDPOINTS.STUDENT.COURSE_MODULES(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get course modules failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Check if student can enroll in a course
   */
  checkEnrollmentEligibility(courseId: string): Observable<CheckEnrollmentEligibilityResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<CheckEnrollmentEligibilityResponse>(
      API_ENDPOINTS.STUDENT.COURSE_ELIGIBILITY(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Check enrollment eligibility failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== ENROLLMENT MANAGEMENT ==========

  /**
   * Get all enrollments for current student
   */
  getMyEnrollments(): Observable<GetStudentEnrollmentsResponse> {
    this.isLoadingSubject.next(true);

    // If offline, get from local database
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - fetching enrollments from local database');

      return from(
        this.tauriDb.getCurrentUser().then(user =>
          this.tauriDb.getUserEnrollments(user.id)
        )
      ).pipe(
        map(enrollments => ({ enrollments } as GetStudentEnrollmentsResponse)),
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    // If online, fetch from API and save to local database
    return this.baseHttpService.get<GetStudentEnrollmentsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENTS
    ).pipe(
      tap(async response => {
        if (response.value?.enrollments) {
          // Save enrollments and courses to local database
          try {
            for (const enrollment of response.value.enrollments) {
              await this.tauriDb.saveEnrollment(enrollment);
              if (enrollment.course) {
                await this.tauriDb.saveCourse(enrollment.course);
              }
            }
            console.log('✅ Enrollments saved to local database');
          } catch (error) {
            console.error('❌ Failed to save enrollments locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('Get enrollments failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Enroll in a course
   */
  enrollInCourse(courseId: string): Observable<EnrollInCourseResponse> {
    this.isLoadingSubject.next(true);

    const request: EnrollInCourseRequest = { course_id: courseId };

    // If offline, queue for sync
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - queueing enrollment for sync');

      return from(
        this.tauriDb.getCurrentUser().then(async user => {
          // Create temporary enrollment
          const tempEnrollment = {
            id: `temp_${Date.now()}`,
            student_id: user.id,
            course_id: courseId,
            status: 'active',
            enrolled_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Save to local database
          await this.tauriDb.saveEnrollment(tempEnrollment);

          // Add to sync queue
          await this.tauriDb.addToSyncQueue(
            'create',
            'enrollments',
            tempEnrollment.id,
            { course_id: courseId }
          );

          return {
            message: 'Enrollment queued (offline)',
            enrollment: tempEnrollment
          } as EnrollInCourseResponse;
        })
      ).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    // If online, enroll via API
    return this.baseHttpService.post<EnrollInCourseResponse>(
      API_ENDPOINTS.STUDENT.ENROLL(courseId),
      request
    ).pipe(
      tap(async response => {
        if (response.value?.enrollment) {
          // Save to local database
          try {
            await this.tauriDb.saveEnrollment(response.value.enrollment);
            if (response.value.enrollment.course) {
              await this.tauriDb.saveCourse(response.value.enrollment.course);
            }
            console.log('✅ Enrollment saved to local database');
          } catch (error) {
            console.error('❌ Failed to save enrollment locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('Enroll in course failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }


  /**
   * Unenroll from a course
   */
  unenrollFromCourse(courseId: string): Observable<UnenrollFromCourseResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.delete<UnenrollFromCourseResponse>(
      API_ENDPOINTS.STUDENT.UNENROLL(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Unenroll from course failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed enrollment information including progress
   */
  getEnrollmentDetails(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetEnrollmentDetailsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENT_DETAILS(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get enrollment details failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== LEARNING & MODULE CONTENT ACCESS ==========

  /**
   * Get module content for learning
   */
  getModuleContent(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    this.isLoadingSubject.next(true);

    // If offline, get from local database
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - fetching module content from local database');

      return from(
        Promise.all([
          this.tauriDb.getModuleById(moduleId),
          this.tauriDb.getModuleContent(moduleId),
          this.tauriDb.getModuleQuiz(moduleId).catch(() => null)
        ])
      ).pipe(
        map(([module, content, quiz]) => ({
          module,
          content,
          quiz
        } as GetModuleContentForStudentResponse)),
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    // If online, fetch from API and save to local database
    return this.baseHttpService.get<GetModuleContentForStudentResponse>(
      API_ENDPOINTS.STUDENT.MODULE_CONTENT(moduleId)
    ).pipe(
      tap(async response => {
        if (response.value) {
          // Save module, content, and quiz to local database
          try {
            if (response.value.module) {
              await this.tauriDb.saveModule(response.value.module);
            }
            if (response.value.content && response.value.content.length > 0) {
              await this.tauriDb.saveContentBlocksBulk(response.value.content);
            }
            if (response.value.quiz) {
              await this.tauriDb.saveQuiz(response.value.quiz);
            }
            console.log('✅ Module content saved to local database');
          } catch (error) {
            console.error('❌ Failed to save module content locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('Get module content failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Mark module as started
   */
  startModule(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    this.isLoadingSubject.next(true);

    const request: MarkModuleAsStartedRequest = { module_id: moduleId };

    return this.baseHttpService.post<MarkModuleAsStartedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_START(moduleId),
      request
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Start module failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Mark module as completed
   */
  completeModule(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    this.isLoadingSubject.next(true);

    const request: MarkModuleAsCompletedRequest = { module_id: moduleId };

    // If offline, save locally and queue for sync
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - saving module completion locally');

      return from(
        this.tauriDb.getCurrentUser().then(async user => {
          const tempProgress = {
            id: `temp_progress_${Date.now()}`,
            enrollment_id: 'temp', // Will be resolved during sync
            module_id: moduleId,
            status: 'completed',
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await this.tauriDb.saveModuleProgress(tempProgress);

          // Add to sync queue
          await this.tauriDb.addToSyncQueue(
            'create',
            'module_progress',
            tempProgress.id,
            { module_id: moduleId, status: 'completed' }
          );

          return {
            message: 'Module completion queued (offline)',
            progress: tempProgress,
            course_completed: false
          } as MarkModuleAsCompletedResponse;
        })
      ).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    // If online, complete via API
    return this.baseHttpService.post<MarkModuleAsCompletedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_COMPLETE(moduleId),
      request
    ).pipe(
      tap(async response => {
        if (response.value?.progress) {
          // Save to local database
          try {
            await this.tauriDb.saveModuleProgress(response.value.progress);
            console.log('✅ Module progress saved to local database');
          } catch (error) {
            console.error('❌ Failed to save module progress locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('Complete module failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== QUIZ & EXAM MANAGEMENT ==========

  /**
   * Get questions for an existing quiz attempt (for resuming)
   */
  getAttemptQuestions(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetAttemptQuestionsResponse>(
      API_ENDPOINTS.STUDENT.ATTEMPT_QUESTIONS(attemptId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get attempt questions failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get all attempts for a quiz
   */
  getQuizAttempts(quizId: string): Observable<GetQuizAttemptsResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetQuizAttemptsResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ATTEMPTS(quizId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get quiz attempts failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Start a new quiz attempt
   */
  startQuiz(quizId: string): Observable<StartQuizAttemptResponse> {
    this.isLoadingSubject.next(true);

    const request: StartQuizAttemptRequest = { quiz_id: quizId };

    // If offline, create local attempt
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - creating quiz attempt locally');

      return from(
        Promise.all([
          this.tauriDb.getCurrentUser(),
          this.tauriDb.getQuizById(quizId),
          this.tauriDb.getQuizQuestions(quizId)
        ]).then(async ([user, quiz, questions]) => {
          const tempAttempt = {
            id: `temp_attempt_${Date.now()}`,
            student_id: user.id,
            quiz_id: quizId,
            attempt_number: 1, // Simplified for offline
            status: 'in_progress',
            started_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await this.tauriDb.saveQuizAttempt(tempAttempt);

          // Add to sync queue
          await this.tauriDb.addToSyncQueue(
            'create',
            'quiz_attempts',
            tempAttempt.id,
            { quiz_id: quizId }
          );

          return {
            message: 'Quiz attempt created (offline)',
            attempt: tempAttempt,
            quiz,
            questions
          } as StartQuizAttemptResponse;
        })
      ).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    // If online, start via API
    return this.baseHttpService.post<StartQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_START(quizId),
      request
    ).pipe(
      tap(async response => {
        if (response.value) {
          // Save to local database
          try {
            if (response.value.attempt) {
              await this.tauriDb.saveQuizAttempt(response.value.attempt);
            }
            if (response.value.quiz) {
              await this.tauriDb.saveQuiz(response.value.quiz);
            }
            if (response.value.questions && response.value.questions.length > 0) {
              await this.tauriDb.saveQuestionsBulk(response.value.questions);
            }
            console.log('✅ Quiz attempt saved to local database');
          } catch (error) {
            console.error('❌ Failed to save quiz attempt locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('Start quiz failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Submit answer for a quiz question
   */
  submitQuizAnswer(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    this.isLoadingSubject.next(true);

    // If offline, save locally and queue for sync
    if (this.connectivityService.isOffline()) {
      console.log('📵 Offline - saving quiz answer locally');

      return from(
        (async () => {
          const tempAnswer = {
            id: `temp_answer_${Date.now()}`,
            attempt_id: attemptId,
            question_id: request.question_id,
            selected_option_id: request.selected_option_id,
            is_correct: false, // Will be calculated during sync
            points_earned: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await this.tauriDb.saveQuizAnswer(tempAnswer);

          // Add to sync queue
          await this.tauriDb.addToSyncQueue(
            'create',
            'quiz_answers',
            tempAnswer.id,
            {
              attempt_id: attemptId,
              question_id: request.question_id,
              selected_option_id: request.selected_option_id
            }
          );

          return {
            message: 'Answer saved (offline)',
            answer: tempAnswer,
            answers_submitted: 0,
            total_questions: 0
          } as SubmitQuizAnswerResponse;
        })()
      ).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    // If online, submit via API
    return this.baseHttpService.post<SubmitQuizAnswerResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ANSWER(attemptId),
      request
    ).pipe(
      tap(async response => {
        if (response.value?.answer) {
          // Save to local database
          try {
            await this.tauriDb.saveQuizAnswer(response.value.answer);
            console.log('✅ Quiz answer saved to local database');
          } catch (error) {
            console.error('❌ Failed to save quiz answer locally:', error);
          }
        }
      }),
      map(response => response.value!),
      catchError(error => {
        console.error('Submit quiz answer failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Complete and submit quiz attempt
   */
  completeQuiz(attemptId: string): Observable<CompleteQuizAttemptResponse> {
    this.isLoadingSubject.next(true);

    const request: CompleteQuizAttemptRequest = { attempt_id: attemptId };

    return this.baseHttpService.post<CompleteQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_COMPLETE(attemptId),
      request
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Complete quiz failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed results of a quiz attempt
   */
  getQuizResults(attemptId: string): Observable<GetQuizResultsResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetQuizResultsResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_RESULTS(attemptId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get quiz results failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // ========== PROGRESS TRACKING & DASHBOARD ==========

  /**
   * Get student dashboard with all enrollments and progress
   */
  getStudentDashboard(): Observable<GetStudentDashboardResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetStudentDashboardResponse>(
      API_ENDPOINTS.STUDENT.DASHBOARD
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get student dashboard failed:', error);
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Get detailed progress for a specific course
   */
  getCourseProgress(courseId: string): Observable<GetCourseProgressResponse> {
    this.isLoadingSubject.next(true);

    return this.baseHttpService.get<GetCourseProgressResponse>(
      API_ENDPOINTS.STUDENT.COURSE_PROGRESS(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        console.error('Get course progress failed:', error);
        return throwError(() => error);
      }),
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
