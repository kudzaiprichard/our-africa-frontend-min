import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseHttpService, API_ENDPOINTS } from '../../core';
import { HttpParams } from '@angular/common/http';

// Course Management DTOs
import {
  GetAllCoursesResponse,
  GetCourseResponse,
  GetCourseModulesResponse
} from '../index';

// Enrollment DTOs
import {
  EnrollInCourseRequest,
  EnrollInCourseResponse,
  UnenrollFromCourseResponse,
  GetStudentEnrollmentsResponse,
  GetEnrollmentDetailsResponse,
  CheckEnrollmentEligibilityResponse,
  GetAvailableCoursesResponse
} from '../index';

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
  GetAttemptQuestionsResponse,
  GetQuizQuestionsForOfflineResponse
} from '../index';

/**
 * Online Provider - Handles all HTTP API calls for course operations
 * Uses BaseHttpService to communicate with backend
 */
@Injectable({
  providedIn: 'root'
})
export class CourseOnlineProvider {

  constructor(private baseHttpService: BaseHttpService) {}

  // ========== COURSE BROWSING & DISCOVERY ==========

  /**
   * Get all published courses with pagination
   */
  getPublishedCourses(page: number = 1, perPage: number = 20): Observable<GetAllCoursesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.baseHttpService.get<GetAllCoursesResponse>(
      API_ENDPOINTS.STUDENT.COURSES,
      params
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get courses available for enrollment (meets prerequisites)
   */
  getAvailableCourses(page: number = 1, perPage: number = 20): Observable<GetAvailableCoursesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.baseHttpService.get<GetAvailableCoursesResponse>(
      API_ENDPOINTS.STUDENT.COURSES_AVAILABLE,
      params
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get detailed information about a specific course
   */
  getCourseDetails(courseId: string): Observable<GetCourseResponse> {
    return this.baseHttpService.get<GetCourseResponse>(
      API_ENDPOINTS.STUDENT.COURSE_DETAILS(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get all modules in a course
   */
  getCourseModules(courseId: string): Observable<GetCourseModulesResponse> {
    return this.baseHttpService.get<GetCourseModulesResponse>(
      API_ENDPOINTS.STUDENT.COURSE_MODULES(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Check if student can enroll in a course
   */
  checkEnrollmentEligibility(courseId: string): Observable<CheckEnrollmentEligibilityResponse> {
    return this.baseHttpService.get<CheckEnrollmentEligibilityResponse>(
      API_ENDPOINTS.STUDENT.COURSE_ELIGIBILITY(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== ENROLLMENT MANAGEMENT ==========

  /**
   * Get all enrollments for current student
   */
  getMyEnrollments(): Observable<GetStudentEnrollmentsResponse> {
    return this.baseHttpService.get<GetStudentEnrollmentsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENTS
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Enroll in a course
   */
  enrollInCourse(courseId: string): Observable<EnrollInCourseResponse> {
    const request: EnrollInCourseRequest = { course_id: courseId };

    return this.baseHttpService.post<EnrollInCourseResponse>(
      API_ENDPOINTS.STUDENT.ENROLL(courseId),
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Unenroll from a course
   */
  unenrollFromCourse(courseId: string): Observable<UnenrollFromCourseResponse> {
    return this.baseHttpService.delete<UnenrollFromCourseResponse>(
      API_ENDPOINTS.STUDENT.UNENROLL(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get detailed enrollment information including progress
   */
  getEnrollmentDetails(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    return this.baseHttpService.get<GetEnrollmentDetailsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENT_DETAILS(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== LEARNING & MODULE CONTENT ACCESS ==========

  /**
   * Get module content for learning
   */
  getModuleContent(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    return this.baseHttpService.get<GetModuleContentForStudentResponse>(
      API_ENDPOINTS.STUDENT.MODULE_CONTENT(moduleId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Mark module as started
   */
  startModule(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    const request: MarkModuleAsStartedRequest = { module_id: moduleId };

    return this.baseHttpService.post<MarkModuleAsStartedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_START(moduleId),
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Mark module as completed
   */
  completeModule(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    const request: MarkModuleAsCompletedRequest = { module_id: moduleId };

    return this.baseHttpService.post<MarkModuleAsCompletedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_COMPLETE(moduleId),
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== QUIZ & EXAM MANAGEMENT ==========

  /**
   * Get questions for an existing quiz attempt (for resuming)
   */
  getAttemptQuestions(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    return this.baseHttpService.get<GetAttemptQuestionsResponse>(
      API_ENDPOINTS.STUDENT.ATTEMPT_QUESTIONS(attemptId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get all attempts for a quiz
   */
  getQuizAttempts(quizId: string): Observable<GetQuizAttemptsResponse> {
    return this.baseHttpService.get<GetQuizAttemptsResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ATTEMPTS(quizId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get quiz questions for offline use
   */
  getQuizQuestions(quizId: string): Observable<GetQuizQuestionsForOfflineResponse> {
    return this.baseHttpService.get<GetQuizQuestionsForOfflineResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_QUESTIONS(quizId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Start a new quiz attempt
   */
  startQuiz(quizId: string): Observable<StartQuizAttemptResponse> {
    const request: StartQuizAttemptRequest = { quiz_id: quizId };

    return this.baseHttpService.post<StartQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_START(quizId),
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Submit answer for a quiz question
   */
  submitQuizAnswer(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    return this.baseHttpService.post<SubmitQuizAnswerResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ANSWER(attemptId),
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Complete and submit quiz attempt
   */
  completeQuiz(attemptId: string): Observable<CompleteQuizAttemptResponse> {
    const request: CompleteQuizAttemptRequest = { attempt_id: attemptId };

    return this.baseHttpService.post<CompleteQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_COMPLETE(attemptId),
      request
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get detailed results of a quiz attempt
   */
  getQuizResults(attemptId: string): Observable<GetQuizResultsResponse> {
    return this.baseHttpService.get<GetQuizResultsResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_RESULTS(attemptId)
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== PROGRESS TRACKING & DASHBOARD ==========

  /**
   * Get student dashboard with all enrollments and progress
   */
  getStudentDashboard(): Observable<GetStudentDashboardResponse> {
    return this.baseHttpService.get<GetStudentDashboardResponse>(
      API_ENDPOINTS.STUDENT.DASHBOARD
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get detailed progress for a specific course
   */
  getCourseProgress(courseId: string): Observable<GetCourseProgressResponse> {
    return this.baseHttpService.get<GetCourseProgressResponse>(
      API_ENDPOINTS.STUDENT.COURSE_PROGRESS(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }
}
