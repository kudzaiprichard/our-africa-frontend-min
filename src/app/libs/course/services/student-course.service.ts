import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
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
  UnenrollFromCourseRequest,
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
  GetCourseProgressResponse
} from '../models/learning-progress.dtos.interface';

@Injectable({
  providedIn: 'root'
})
export class StudentCourseService {

  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  constructor(private baseHttpService: BaseHttpService) {}

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

    return this.baseHttpService.get<GetStudentEnrollmentsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENTS
    ).pipe(
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

    return this.baseHttpService.post<EnrollInCourseResponse>(
      API_ENDPOINTS.STUDENT.ENROLL(courseId),
      {}
    ).pipe(
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

    return this.baseHttpService.get<GetModuleContentForStudentResponse>(
      API_ENDPOINTS.STUDENT.MODULE_CONTENT(moduleId)
    ).pipe(
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

    return this.baseHttpService.post<MarkModuleAsStartedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_START(moduleId),
      {}
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

    return this.baseHttpService.post<MarkModuleAsCompletedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_COMPLETE(moduleId),
      {}
    ).pipe(
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

    return this.baseHttpService.post<StartQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_START(quizId),
      {}
    ).pipe(
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

    return this.baseHttpService.post<SubmitQuizAnswerResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ANSWER(attemptId),
      request
    ).pipe(
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

    return this.baseHttpService.post<CompleteQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_COMPLETE(attemptId),
      {}
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
