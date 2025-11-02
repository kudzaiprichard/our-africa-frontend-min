// src/app/libs/student/providers/course.provider.ts

import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { HttpParams } from '@angular/common/http';
import { BaseHttpService, API_ENDPOINTS } from '../../core';
import { ConnectivityService } from '../../../theme/shared/services/connectivity.service';
import { TauriDatabaseService } from '../../../theme/shared/services/tauri-database.service';

// Course Management DTOs
import {
  GetAllCoursesResponse,
  GetCourseResponse,
  GetCourseModulesResponse,
  CourseBasic
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
  GetAttemptQuestionsResponse,
  GetQuizQuestionsForOfflineResponse,
  MarkContentAsViewedRequest,
  MarkContentAsViewedResponse,
  MarkContentAsCompletedRequest,
  MarkContentAsCompletedResponse,
  GetModuleResumeDataResponse,
  EnrollmentWithCourseAndProgressSummary
} from '../models/learning-progress.dtos.interface';
import {ToastsService} from '../../../theme/shared';

@Injectable({
  providedIn: 'root'
})
export class CourseProvider {

  constructor(
    private http: BaseHttpService,
    private connectivity: ConnectivityService,
    private db: TauriDatabaseService,
    private toasts: ToastsService
  ) {}

  // ============================================================================
  // COURSE BROWSING & DISCOVERY
  // ============================================================================

  getPublishedCourses(page: number = 1, perPage: number = 20): Observable<GetAllCoursesResponse> {
    if (this.connectivity.isOffline()) {
      return this.getPublishedCoursesOffline(page, perPage);
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<GetAllCoursesResponse>(
      API_ENDPOINTS.STUDENT.COURSES,
      params
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.courses && data.courses.length > 0) {
          for (const course of data.courses) {
            await this.saveCourseToLocal(course);
          }
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to load courses. Please try again.');
        return throwError(() => error);
      })
    );
  }

  getAvailableCourses(page: number = 1, perPage: number = 20): Observable<GetAvailableCoursesResponse> {
    if (this.connectivity.isOffline()) {
      this.toasts.warning('You need to be online to browse new courses.');
      return throwError(() => new Error('Browsing new courses requires an internet connection.'));
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<GetAvailableCoursesResponse>(
      API_ENDPOINTS.STUDENT.COURSES_AVAILABLE,
      params
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load available courses.');
        return throwError(() => error);
      })
    );
  }

  getCourseDetails(courseId: string): Observable<GetCourseResponse> {
    if (this.connectivity.isOffline()) {
      return this.getCourseDetailsOffline(courseId);
    }

    return this.http.get<GetCourseResponse>(
      API_ENDPOINTS.STUDENT.COURSE_DETAILS(courseId)
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.course) {
          await this.saveCourseToLocal(data.course);
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to load course details.');
        return throwError(() => error);
      })
    );
  }

  getCourseModules(courseId: string): Observable<GetCourseModulesResponse> {
    if (this.connectivity.isOffline()) {
      return this.getCourseModulesOffline(courseId);
    }

    return this.http.get<GetCourseModulesResponse>(
      API_ENDPOINTS.STUDENT.COURSE_MODULES(courseId)
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.modules && data.modules.length > 0) {
          await this.db.saveModulesBulk(data.modules);
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to load course modules.');
        return throwError(() => error);
      })
    );
  }

  checkEnrollmentEligibility(courseId: string): Observable<CheckEnrollmentEligibilityResponse> {
    if (this.connectivity.isOffline()) {
      this.toasts.warning('You need to be online to check enrollment eligibility.');
      return throwError(() => new Error('Checking enrollment eligibility requires an internet connection.'));
    }

    return this.http.get<CheckEnrollmentEligibilityResponse>(
      API_ENDPOINTS.STUDENT.COURSE_ELIGIBILITY(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to check enrollment eligibility.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // ENROLLMENT MANAGEMENT
  // ============================================================================

  getMyEnrollments(): Observable<GetStudentEnrollmentsResponse> {
    if (this.connectivity.isOffline()) {
      return this.getMyEnrollmentsOffline();
    }

    return this.http.get<GetStudentEnrollmentsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENTS
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.enrollments && data.enrollments.length > 0) {
          for (const enrollment of data.enrollments) {
            if (enrollment.course) {
              await this.saveCourseToLocal(enrollment.course);
            }
            await this.db.saveEnrollment(enrollment);
          }
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to load your enrolled courses.');
        return throwError(() => error);
      })
    );
  }

  enrollInCourse(courseId: string): Observable<EnrollInCourseResponse> {
    if (this.connectivity.isOffline()) {
      this.toasts.warning('You need to be online to enroll in courses.');
      return throwError(() => new Error('Enrolling in courses requires an internet connection.'));
    }

    const request: EnrollInCourseRequest = { course_id: courseId };

    return this.http.post<EnrollInCourseResponse>(
      API_ENDPOINTS.STUDENT.ENROLL(courseId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.enrollment) {
          if (data.enrollment.course) {
            await this.saveCourseToLocal(data.enrollment.course);
          }
          await this.db.saveEnrollment(data.enrollment);
        }
        this.toasts.success('Successfully enrolled in course!');
      }),
      catchError(error => {
        this.toasts.error('Unable to enroll in this course.');
        return throwError(() => error);
      })
    );
  }

  unenrollFromCourse(courseId: string): Observable<UnenrollFromCourseResponse> {
    if (this.connectivity.isOffline()) {
      this.toasts.warning('You need to be online to unenroll from courses.');
      return throwError(() => new Error('Unenrolling from courses requires an internet connection.'));
    }

    return this.http.delete<UnenrollFromCourseResponse>(
      API_ENDPOINTS.STUDENT.UNENROLL(courseId)
    ).pipe(
      map(response => response.value!),
      tap(() => {
        this.toasts.success('Successfully unenrolled from course.');
      }),
      catchError(error => {
        this.toasts.error('Unable to unenroll from this course.');
        return throwError(() => error);
      })
    );
  }

  getEnrollmentDetails(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    if (this.connectivity.isOffline()) {
      return this.getEnrollmentDetailsOffline(courseId);
    }

    return this.http.get<GetEnrollmentDetailsResponse>(
      API_ENDPOINTS.STUDENT.ENROLLMENT_DETAILS(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load enrollment details.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // LEARNING & MODULE CONTENT ACCESS
  // ============================================================================

  getModuleContent(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    if (this.connectivity.isOffline()) {
      return this.getModuleContentOffline(moduleId);
    }

    return this.http.get<GetModuleContentForStudentResponse>(
      API_ENDPOINTS.STUDENT.MODULE_CONTENT(moduleId)
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.module) {
          await this.db.saveModule(data.module);
        }
        if (data.content && data.content.length > 0) {
          await this.db.saveContentBlocksBulk(data.content);
        }
        if (data.quiz) {
          await this.db.saveQuiz(data.quiz);
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to load module content.');
        return throwError(() => error);
      })
    );
  }

  startModule(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    if (this.connectivity.isOffline()) {
      return this.startModuleOffline(moduleId);
    }

    const request: MarkModuleAsStartedRequest = { module_id: moduleId };

    return this.http.post<MarkModuleAsStartedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_START(moduleId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.progress) {
          await this.db.saveModuleProgress(data.progress);
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to start module.');
        return throwError(() => error);
      })
    );
  }

  completeModule(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    if (this.connectivity.isOffline()) {
      return this.completeModuleOffline(moduleId);
    }

    const request: MarkModuleAsCompletedRequest = { module_id: moduleId };

    return this.http.post<MarkModuleAsCompletedResponse>(
      API_ENDPOINTS.STUDENT.MODULE_COMPLETE(moduleId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.progress) {
          await this.db.saveModuleProgress(data.progress);
        }
        this.toasts.success('Module completed!');
      }),
      catchError(error => {
        this.toasts.error('Unable to complete module.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // QUIZ & EXAM MANAGEMENT
  // ============================================================================

  getAttemptQuestions(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    if (this.connectivity.isOffline()) {
      return this.getAttemptQuestionsOffline(attemptId);
    }

    return this.http.get<GetAttemptQuestionsResponse>(
      API_ENDPOINTS.STUDENT.ATTEMPT_QUESTIONS(attemptId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load quiz questions.');
        return throwError(() => error);
      })
    );
  }

  getQuizAttempts(quizId: string): Observable<GetQuizAttemptsResponse> {
    if (this.connectivity.isOffline()) {
      return this.getQuizAttemptsOffline(quizId);
    }

    return this.http.get<GetQuizAttemptsResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ATTEMPTS(quizId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load quiz attempts.');
        return throwError(() => error);
      })
    );
  }

  getQuizQuestions(quizId: string): Observable<GetQuizQuestionsForOfflineResponse> {
    if (this.connectivity.isOffline()) {
      return this.getQuizQuestionsOffline(quizId);
    }

    return this.http.get<GetQuizQuestionsForOfflineResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_QUESTIONS(quizId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load quiz questions.');
        return throwError(() => error);
      })
    );
  }

  startQuiz(quizId: string): Observable<StartQuizAttemptResponse> {
    if (this.connectivity.isOffline()) {
      return this.startQuizOffline(quizId);
    }

    const request: StartQuizAttemptRequest = { quiz_id: quizId };

    return this.http.post<StartQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_START(quizId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.attempt) {
          await this.db.saveQuizAttempt(data.attempt);
        }
        if (data.quiz) {
          await this.db.saveQuiz(data.quiz);
        }
        if (data.questions && data.questions.length > 0) {
          await this.db.saveQuestionsBulk(data.questions);
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to start quiz.');
        return throwError(() => error);
      })
    );
  }

  submitQuizAnswer(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    if (this.connectivity.isOffline()) {
      return this.submitQuizAnswerOffline(attemptId, request);
    }

    return this.http.post<SubmitQuizAnswerResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_ANSWER(attemptId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.answer) {
          await this.db.saveQuizAnswer(data.answer);
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to save your answer.');
        return throwError(() => error);
      })
    );
  }

  completeQuiz(attemptId: string, forceSubmit: boolean = false): Observable<CompleteQuizAttemptResponse> {
    if (this.connectivity.isOffline()) {
      return this.completeQuizOffline(attemptId, forceSubmit);
    }

    const request: CompleteQuizAttemptRequest = {
      attempt_id: attemptId,
      force_submit: forceSubmit
    };

    return this.http.post<CompleteQuizAttemptResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_COMPLETE(attemptId),
      request
    ).pipe(
      map(response => response.value!),
      tap(data => {
        if (data.passed) {
          this.toasts.success('Congratulations! You passed the quiz.');
        } else {
          this.toasts.info('Quiz completed. Keep practicing!');
        }
      }),
      catchError(error => {
        this.toasts.error('Unable to submit quiz.');
        return throwError(() => error);
      })
    );
  }

  abandonQuiz(attemptId: string): Observable<any> {
    if (this.connectivity.isOffline()) {
      return this.abandonQuizOffline(attemptId);
    }

    return this.http.post<any>(
      API_ENDPOINTS.STUDENT.QUIZ_ABANDON(attemptId),
      {}
    ).pipe(
      map(response => response.value!),
      tap(() => {
        this.toasts.info('Quiz abandoned.');
      }),
      catchError(error => {
        this.toasts.error('Unable to abandon quiz.');
        return throwError(() => error);
      })
    );
  }

  getQuizResults(attemptId: string): Observable<GetQuizResultsResponse> {
    if (this.connectivity.isOffline()) {
      return this.getQuizResultsOffline(attemptId);
    }

    return this.http.get<GetQuizResultsResponse>(
      API_ENDPOINTS.STUDENT.QUIZ_RESULTS(attemptId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load quiz results.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // PROGRESS TRACKING & DASHBOARD
  // ============================================================================

  getStudentDashboard(): Observable<GetStudentDashboardResponse> {
    if (this.connectivity.isOffline()) {
      return this.getStudentDashboardOffline();
    }

    return this.http.get<GetStudentDashboardResponse>(
      API_ENDPOINTS.STUDENT.DASHBOARD
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load dashboard.');
        return throwError(() => error);
      })
    );
  }

  getCourseProgress(courseId: string): Observable<GetCourseProgressResponse> {
    if (this.connectivity.isOffline()) {
      return this.getCourseProgressOffline(courseId);
    }

    return this.http.get<GetCourseProgressResponse>(
      API_ENDPOINTS.STUDENT.COURSE_PROGRESS(courseId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load course progress.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // CONTENT PROGRESS TRACKING
  // ============================================================================

  markContentAsViewed(contentId: string): Observable<MarkContentAsViewedResponse> {
    if (this.connectivity.isOffline()) {
      return this.markContentAsViewedOffline(contentId);
    }

    const request: MarkContentAsViewedRequest = { content_id: contentId };

    return this.http.post<MarkContentAsViewedResponse>(
      API_ENDPOINTS.STUDENT.CONTENT_VIEW(contentId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.progress) {
          await this.db.saveContentProgress(data.progress);
        }
      })
    );
  }

  markContentAsCompleted(contentId: string): Observable<MarkContentAsCompletedResponse> {
    if (this.connectivity.isOffline()) {
      return this.markContentAsCompletedOffline(contentId);
    }

    const request: MarkContentAsCompletedRequest = { content_id: contentId };

    return this.http.post<MarkContentAsCompletedResponse>(
      API_ENDPOINTS.STUDENT.CONTENT_COMPLETE(contentId),
      request
    ).pipe(
      map(response => response.value!),
      tap(async data => {
        if (data.progress) {
          await this.db.saveContentProgress(data.progress);
        }
      })
    );
  }

  getModuleResumeData(moduleId: string): Observable<GetModuleResumeDataResponse> {
    if (this.connectivity.isOffline()) {
      return this.getModuleResumeDataOffline(moduleId);
    }

    return this.http.get<GetModuleResumeDataResponse>(
      API_ENDPOINTS.STUDENT.MODULE_RESUME(moduleId)
    ).pipe(
      map(response => response.value!),
      catchError(error => {
        this.toasts.error('Unable to load module progress.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // OFFLINE IMPLEMENTATIONS
  // ============================================================================

  private getPublishedCoursesOffline(page: number, perPage: number): Observable<GetAllCoursesResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrolledCourses = enrollments
          .filter((e: any) => e.course)
          .map((e: any) => e.course);

        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedCourses = enrolledCourses.slice(startIndex, endIndex);

        return {
          courses: paginatedCourses,
          total: enrolledCourses.length,
          page,
          per_page: perPage,
          total_pages: Math.ceil(enrolledCourses.length / perPage)
        } as GetAllCoursesResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load courses offline.');
        return throwError(() => error);
      })
    );
  }

  private getCourseDetailsOffline(courseId: string): Observable<GetCourseResponse> {
    return from(
      this.db.getCourseById(courseId).then(async course => {
        let finalExam: any | undefined;
        try {
          finalExam = await this.db.getCourseFinalExam(courseId);
        } catch (error) {
          finalExam = undefined;
        }

        return { course, final_exam: finalExam } as GetCourseResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('This course is not available offline.');
        return throwError(() => new Error('This course is not available offline.'));
      })
    );
  }

  private getCourseModulesOffline(courseId: string): Observable<GetCourseModulesResponse> {
    return from(
      this.db.getCourseModules(courseId).then(modules => {
        return { modules } as GetCourseModulesResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.warning('Unable to load modules offline.');
        return from(Promise.resolve({ modules: [] } as GetCourseModulesResponse));
      })
    );
  }

  private getMyEnrollmentsOffline(): Observable<GetStudentEnrollmentsResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const enrollments = await this.db.getUserEnrollments(user.id);

        const enrichedEnrollments = await Promise.all(
          enrollments.map(async (enrollment: any) => {
            let course = enrollment.course;
            if (!course) {
              try {
                course = await this.db.getCourseById(enrollment.course_id);
              } catch (error) {
                course = null;
              }
            }

            const progressSummary = await this.db.getCourseProgressSummary(enrollment.id);
            const modules = await this.db.getCourseModules(enrollment.course_id);
            const moduleProgress = await this.db.getEnrollmentProgress(enrollment.id);

            const completedModuleIds = moduleProgress
              .filter((p: any) => p.status === 'completed')
              .map((p: any) => p.module_id);

            const nextModule = modules.find((m: any) => !completedModuleIds.includes(m.id));
            const canTakeFinalExam = progressSummary.completed_modules === progressSummary.total_modules;

            return {
              ...enrollment,
              course: course,
              progress: progressSummary,
              next_module: nextModule || undefined,
              can_take_final_exam: canTakeFinalExam
            };
          })
        );

        return { enrollments: enrichedEnrollments } as GetStudentEnrollmentsResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load your enrolled courses offline.');
        return throwError(() => error);
      })
    );
  }

  private getEnrollmentDetailsOffline(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollmentWithCourse = enrollments.find((e: any) => e.course_id === courseId);

        if (!enrollmentWithCourse) {
          throw new Error('Enrollment not found offline.');
        }

        const progressSummary = await this.db.getCourseProgressSummary(enrollmentWithCourse.id);
        const { course, ...enrollmentBasic } = enrollmentWithCourse;

        return {
          enrollment: enrollmentBasic,
          course: course,
          progress: progressSummary
        } as GetEnrollmentDetailsResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Enrollment not found offline.');
        return throwError(() => error);
      })
    );
  }

  private getModuleContentOffline(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const module = await this.db.getModuleById(moduleId);
        const content = await this.db.getModuleContent(moduleId);
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found for this module.');
        }

        const moduleProgress = await this.db.getEnrollmentProgress(enrollment.id);
        const progress = moduleProgress.find((p: any) => p.module_id === moduleId);

        const moduleWithProgress = {
          ...module,
          progress: progress || {
            id: `temp_${moduleId}`,
            enrollment_id: enrollment.id,
            module_id: moduleId,
            status: 'not_started',
            auto_completed: false,
            content_completion_percentage: 0,
            completed_content_count: 0,
            total_content_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          is_locked: false,
          quiz_status: progress?.status === 'completed' ? 'passed' : 'not_started'
        };

        let quiz: any | undefined;
        try {
          quiz = await this.db.getModuleQuiz(moduleId);
          const attempts = await this.db.getQuizAttempts(quiz.id, user.id);
          const passedAttempt = attempts.find((a: any) => a.passed === true || a.passed === 1);
          const studentPassed = !!passedAttempt;
          const studentAttemptsCount = attempts.length;

          let studentCanAttempt = true;
          if (studentPassed) {
            studentCanAttempt = false;
          } else if (quiz.max_attempts && studentAttemptsCount >= quiz.max_attempts) {
            if (quiz.attempt_reset_hours > 0) {
              const lastAttempt = attempts[attempts.length - 1];
              if (lastAttempt && lastAttempt.completed_at) {
                const lastAttemptTime = new Date(lastAttempt.completed_at).getTime();
                const cooldownMs = quiz.attempt_reset_hours * 60 * 60 * 1000;
                const now = Date.now();
                studentCanAttempt = now - lastAttemptTime >= cooldownMs;
              }
            } else {
              studentCanAttempt = false;
            }
          }

          const bestScore = attempts.length > 0
            ? Math.max(...attempts.filter((a: any) => a.score != null).map((a: any) => a.score))
            : undefined;

          quiz = {
            ...quiz,
            student_best_score: bestScore,
            student_attempts_count: studentAttemptsCount,
            student_can_attempt: studentCanAttempt,
            student_passed: studentPassed
          };
        } catch (error) {
          quiz = undefined;
        }

        return {
          module: moduleWithProgress,
          content,
          quiz
        } as GetModuleContentForStudentResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load module content offline.');
        return throwError(() => error);
      })
    );
  }

  private startModuleOffline(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const module = await this.db.getModuleById(moduleId);
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found for this module');
        }

        const tempProgress = {
          id: `temp_progress_${Date.now()}`,
          enrollment_id: enrollment.id,
          module_id: moduleId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          auto_completed: false,
          content_completion_percentage: 0,
          completed_content_count: 0,
          total_content_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.db.saveModuleProgress(tempProgress);
        await this.db.addToSyncQueue('create', 'module_progress', tempProgress.id,
          { module_id: moduleId, status: 'in_progress' });

        this.toasts.info('Module started. Changes will sync when online.');

        return {
          message: 'Module started (offline) - Will sync when online',
          progress: tempProgress
        } as MarkModuleAsStartedResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to start module offline.');
        return throwError(() => error);
      })
    );
  }

  private completeModuleOffline(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const module = await this.db.getModuleById(moduleId);
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found for this module');
        }

        const tempProgress = {
          id: `temp_progress_${Date.now()}`,
          enrollment_id: enrollment.id,
          module_id: moduleId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          auto_completed: false,
          content_completion_percentage: 100,
          completed_content_count: 0,
          total_content_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.db.saveModuleProgress(tempProgress);
        await this.db.addToSyncQueue('create', 'module_progress', tempProgress.id,
          { module_id: moduleId, status: 'completed' });

        this.toasts.success('Module completed! Changes will sync when online.');

        return {
          message: 'Module completed (offline) - Will sync when online',
          progress: tempProgress,
          course_completed: false
        } as MarkModuleAsCompletedResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to complete module offline.');
        return throwError(() => error);
      })
    );
  }

  private getAttemptQuestionsOffline(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const attempt = await this.db.getQuizAttemptById(attemptId);
        const quiz = await this.db.getQuizById(attempt.quiz_id);
        const questions = await this.db.getQuizQuestions(attempt.quiz_id);
        const answers = await this.db.getAttemptAnswers(attemptId);

        const submittedAnswers: { [question_id: string]: string } = {};
        answers.forEach((answer: any) => {
          submittedAnswers[answer.question_id] = answer.selected_option_id;
        });

        return {
          attempt,
          quiz,
          questions,
          submitted_answers: submittedAnswers
        } as GetAttemptQuestionsResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load quiz questions offline.');
        return throwError(() => error);
      })
    );
  }

  private getQuizAttemptsOffline(quizId: string): Observable<GetQuizAttemptsResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const quiz = await this.db.getQuizById(quizId);
        const attempts = await this.db.getQuizAttempts(quizId, user.id);
        const bestScore = await this.db.getBestQuizScore(quizId, user.id);

        return {
          quiz,
          attempts,
          best_score: bestScore || undefined
        } as GetQuizAttemptsResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load quiz attempts offline.');
        return throwError(() => error);
      })
    );
  }

  private getQuizQuestionsOffline(quizId: string): Observable<GetQuizQuestionsForOfflineResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const quiz = await this.db.getQuizById(quizId);
        const questions = await this.db.getQuizQuestions(quizId);

        return { quiz, questions } as GetQuizQuestionsForOfflineResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load quiz questions offline.');
        return throwError(() => error);
      })
    );
  }

  private startQuizOffline(quizId: string): Observable<StartQuizAttemptResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const quiz = await this.db.getQuizById(quizId);
        const questions = await this.db.getQuizQuestions(quizId);
        const existingAttempts = await this.db.getQuizAttempts(quizId, user.id);

        const tempAttempt = {
          id: `temp_attempt_${Date.now()}`,
          student_id: user.id,
          quiz_id: quizId,
          attempt_number: existingAttempts.length + 1,
          status: 'in_progress' as const,
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.db.saveQuizAttempt(tempAttempt);
        await this.db.addToSyncQueue('create', 'quiz_attempts', tempAttempt.id, { quiz_id: quizId });

        this.toasts.info('Quiz started offline. Your answers will sync when online.');

        return {
          message: 'Quiz started (offline) - Will sync when online',
          attempt: tempAttempt,
          quiz,
          questions
        } as StartQuizAttemptResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to start quiz offline.');
        return throwError(() => error);
      })
    );
  }

  private submitQuizAnswerOffline(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    return from(
      (async () => {
        const attempt = await this.db.getQuizAttemptById(attemptId);
        const questions = await this.db.getQuizQuestions(attempt.quiz_id);
        const question = questions.find((q: any) => q.id === request.question_id);

        if (!question) {
          throw new Error('Question not found');
        }

        const selectedOption = question.options.find((o: any) => o.id === request.selected_option_id);
        const isCorrect = (selectedOption?.is_correct === 1 || selectedOption?.is_correct === true);
        const pointsEarned = isCorrect ? (question.points || 1) : 0;

        const answerToSave = {
          id: `temp_answer_${Date.now()}`,
          attempt_id: attemptId,
          question_id: request.question_id,
          selected_option_id: request.selected_option_id,
          is_correct: isCorrect ? 1 : 0,
          points_earned: pointsEarned,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.db.saveQuizAnswer(answerToSave);
        await this.db.addToSyncQueue('create', 'quiz_answers', answerToSave.id, {
          attempt_id: attemptId,
          question_id: request.question_id,
          selected_option_id: request.selected_option_id,
          is_correct: isCorrect,
          points_earned: pointsEarned
        });

        const allQuestions = await this.db.getQuizQuestions(attempt.quiz_id);
        const answers = await this.db.getAttemptAnswers(attemptId);

        return {
          message: 'Answer saved (offline) - Will sync when online',
          answer: {
            id: answerToSave.id,
            attempt_id: answerToSave.attempt_id,
            question_id: answerToSave.question_id,
            selected_option_id: answerToSave.selected_option_id,
            is_correct: isCorrect,
            points_earned: answerToSave.points_earned,
            created_at: answerToSave.created_at,
            updated_at: answerToSave.updated_at
          },
          answers_submitted: answers.length,
          total_questions: allQuestions.length
        } as SubmitQuizAnswerResponse;
      })()
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to save your answer offline.');
        return throwError(() => error);
      })
    );
  }

  private completeQuizOffline(attemptId: string, forceSubmit: boolean): Observable<CompleteQuizAttemptResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const attempt = await this.db.getQuizAttemptById(attemptId);
        const quiz = await this.db.getQuizById(attempt.quiz_id);
        const scoreData = await this.db.calculateAttemptScore(attemptId);

        const score = scoreData.percentage || 0;
        const passed = score >= quiz.pass_mark_percentage;

        await this.db.updateQuizAttemptStatus(attemptId, 'completed', score, passed);
        await this.db.addToSyncQueue('update', 'quiz_attempts', attemptId, {
          status: 'completed',
          score: score,
          passed: passed,
          completed_at: new Date().toISOString(),
          force_submit: forceSubmit
        });

        const completedAttempt = {
          ...attempt,
          status: 'completed' as const,
          score: score,
          passed: passed,
          completed_at: new Date().toISOString()
        };

        if (passed) {
          this.toasts.success('Congratulations! You passed the quiz offline.');
        } else {
          this.toasts.info('Quiz completed offline. Keep practicing!');
        }

        return {
          message: forceSubmit
            ? 'Quiz auto-submitted (offline) - Will sync when online'
            : 'Quiz completed (offline) - Will sync when online',
          attempt: completedAttempt,
          quiz,
          score: score,
          passed: passed,
          total_questions: scoreData.total_questions || 0,
          correct_answers: scoreData.correct_answers || 0,
          points_earned: scoreData.points_earned || 0,
          points_possible: scoreData.points_possible || 0,
          can_retake: !passed && (!quiz.max_attempts || quiz.student_attempts_count < quiz.max_attempts)
        } as CompleteQuizAttemptResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to complete quiz offline.');
        return throwError(() => error);
      })
    );
  }

  private abandonQuizOffline(attemptId: string): Observable<any> {
    return from(
      (async () => {
        const attempt = await this.db.getQuizAttemptById(attemptId);
        await this.db.updateQuizAttemptStatus(attemptId, 'abandoned', undefined, undefined);
        await this.db.addToSyncQueue('update', 'quiz_attempts', attemptId, {
          status: 'abandoned',
          completed_at: new Date().toISOString()
        });

        this.toasts.info('Quiz abandoned offline.');

        return {
          message: 'Quiz abandoned (offline) - Will sync when online',
          attempt: {
            ...attempt,
            status: 'abandoned',
            completed_at: new Date().toISOString()
          }
        };
      })()
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to abandon quiz offline.');
        return throwError(() => error);
      })
    );
  }

  private getQuizResultsOffline(attemptId: string): Observable<GetQuizResultsResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const attempt = await this.db.getQuizAttemptById(attemptId);
        const quiz = await this.db.getQuizById(attempt.quiz_id);
        const questions = await this.db.getQuizQuestions(attempt.quiz_id);
        const answers = await this.db.getAttemptAnswers(attemptId);

        const questionsWithAnswers = questions.map((question: any) => {
          const answer = answers.find((a: any) => a.question_id === question.id);
          const correctOption = question.options.find((o: any) => o.is_correct === 1 || o.is_correct === true);
          const isAnswerCorrect = answer?.is_correct === 1 || answer?.is_correct === true;

          return {
            id: question.id,
            quiz_id: question.quiz_id,
            question_text: question.question_text,
            image_url: question.image_url,
            order: question.order,
            points: question.points,
            options: question.options.map((opt: any) => ({
              id: opt.id,
              question_id: opt.question_id || question.id,
              option_text: opt.option_text,
              is_correct: opt.is_correct === 1 || opt.is_correct === true,
              order: opt.order
            })),
            student_selected_option_id: answer?.selected_option_id || undefined,
            correct_option_id: correctOption?.id || '',
            is_correct: isAnswerCorrect,
            points_earned: answer?.points_earned || 0
          };
        });

        let score = attempt.score;
        let passed = attempt.passed;

        if (score === undefined || score === null) {
          const scoreData = await this.db.calculateAttemptScore(attemptId);
          score = scoreData.percentage || 0;
          passed = score >= quiz.pass_mark_percentage;
        }

        return {
          attempt: { ...attempt, score, passed },
          quiz,
          questions_with_answers: questionsWithAnswers,
          score,
          passed
        } as GetQuizResultsResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load quiz results offline.');
        return throwError(() => error);
      })
    );
  }

  private getStudentDashboardOffline(): Observable<GetStudentDashboardResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const enrollments = await this.db.getUserEnrollments(user.id);

        const enrichedEnrollments: EnrollmentWithCourseAndProgressSummary[] = await Promise.all(
          enrollments.map(async (enrollment: any) => {
            let course: CourseBasic;
            if (enrollment.course) {
              course = enrollment.course;
            } else {
              course = await this.db.getCourseById(enrollment.course_id);
            }

            const progressSummary = await this.db.getCourseProgressSummary(enrollment.id);
            const modules = await this.db.getCourseModules(enrollment.course_id);
            const actualModuleCount = modules.length;
            const fixedTotalModules = actualModuleCount > 0 ? actualModuleCount : (progressSummary.total_modules || 0);

            const enriched: EnrollmentWithCourseAndProgressSummary = {
              id: enrollment.id,
              student_id: enrollment.student_id,
              course_id: enrollment.course_id,
              status: enrollment.status,
              enrolled_at: enrollment.enrolled_at,
              completed_at: enrollment.completed_at || undefined,
              course: course,
              completed_modules: progressSummary.completed_modules || 0,
              total_modules: fixedTotalModules,
              completion_percentage: progressSummary.completion_percentage || 0,
              last_accessed_at: progressSummary.last_accessed_at || undefined,
              next_module_id: progressSummary.last_accessed_module_id || undefined
            };

            return enriched;
          })
        );

        const completedCourses = enrichedEnrollments.filter(e => e.status === 'completed');
        const inProgressCourses = enrichedEnrollments.filter(e => {
          const hasAccessed = !!e.last_accessed_at;
          const hasProgress = (e.completion_percentage || 0) > 0;
          return e.status === 'active' && (hasAccessed || hasProgress);
        });
        const activeCourses = enrichedEnrollments.filter(e => {
          const hasAccessed = !!e.last_accessed_at;
          const hasProgress = (e.completion_percentage || 0) > 0;
          return e.status === 'active' && !hasAccessed && !hasProgress;
        });

        const continueLearning = inProgressCourses.length > 0
          ? inProgressCourses.sort((a, b) => {
            const dateA = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
            const dateB = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
            return dateB - dateA;
          })[0]
          : undefined;

        const response: GetStudentDashboardResponse = {
          active_enrollments: activeCourses,
          completed_courses: completedCourses,
          in_progress_courses: inProgressCourses,
          total_courses: enrichedEnrollments.length,
          total_completed: completedCourses.length,
          total_in_progress: inProgressCourses.length,
          continue_learning: continueLearning
        };

        return response;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load dashboard offline.');
        return throwError(() => error);
      })
    );
  }

  private getCourseProgressOffline(courseId: string): Observable<GetCourseProgressResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollmentData = enrollments.find((e: any) => e.course_id === courseId);

        if (!enrollmentData) {
          throw new Error('Course progress not available offline.');
        }

        const course = await this.db.getCourseById(courseId);
        const modules = await this.db.getCourseModules(courseId);
        const moduleProgress = await this.db.getEnrollmentProgress(enrollmentData.id);

        const modulesWithProgress = modules.map((module: any) => {
          const progress = moduleProgress.find((p: any) => p.module_id === module.id);

          return {
            ...module,
            progress: progress || {
              id: `temp_${module.id}`,
              enrollment_id: enrollmentData.id,
              module_id: module.id,
              status: 'not_started',
              auto_completed: false,
              content_completion_percentage: 0,
              completed_content_count: 0,
              total_content_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            is_locked: false,
            quiz_status: progress?.status === 'completed' ? 'passed' : 'not_started'
          };
        });

        const progressSummary = await this.db.getCourseProgressSummary(enrollmentData.id);
        const completedModuleIds = moduleProgress
          .filter((p: any) => p.status === 'completed')
          .map((p: any) => p.module_id);
        const nextModule = modules.find((m: any) => !completedModuleIds.includes(m.id));
        const canTakeFinalExam = progressSummary.completed_modules === progressSummary.total_modules;

        const { course: _, ...enrollmentBasic } = enrollmentData;

        return {
          course,
          enrollment: enrollmentBasic,
          modules_progress: modulesWithProgress,
          completion_percentage: progressSummary.completion_percentage,
          completed_modules: progressSummary.completed_modules,
          total_modules: progressSummary.total_modules,
          next_module_id: nextModule?.id,
          can_take_final_exam: canTakeFinalExam,
          final_exam_status: canTakeFinalExam ? 'not_started' : undefined
        } as GetCourseProgressResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load course progress offline.');
        return throwError(() => error);
      })
    );
  }

  private markContentAsViewedOffline(contentId: string): Observable<MarkContentAsViewedResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const content = await this.db.getContentBlockById(contentId);
        const module = await this.db.getModuleById(content.module_id);
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found');
        }

        const progress_id = `cp_${enrollment.id}_${contentId}`;

        let existingProgress;
        try {
          existingProgress = await this.db.getContentProgressByContentId(enrollment.id, contentId);
        } catch (e) {
          existingProgress = null;
        }

        const tempProgress = {
          id: progress_id,
          enrollment_id: enrollment.id,
          content_id: contentId,
          is_completed: existingProgress?.is_completed || false,
          viewed_at: new Date().toISOString(),
          created_at: existingProgress?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.db.saveContentProgress(tempProgress);
        await this.db.addToSyncQueue('create', 'content_progress', tempProgress.id,
          { content_id: contentId, viewed: true });

        return {
          message: 'Content marked as viewed (offline) - Will sync when online',
          progress: tempProgress,
          module_auto_completed: false
        } as MarkContentAsViewedResponse;
      })
    );
  }

  private markContentAsCompletedOffline(contentId: string): Observable<MarkContentAsCompletedResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const content = await this.db.getContentBlockById(contentId);
        const module = await this.db.getModuleById(content.module_id);
        const enrollments = await this.db.getUserEnrollments(user.id);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found');
        }

        const progress_id = `cp_${enrollment.id}_${contentId}`;

        let existingProgress;
        try {
          existingProgress = await this.db.getContentProgressByContentId(enrollment.id, contentId);

          if (existingProgress?.is_completed) {
            return {
              message: 'Content already completed',
              progress: existingProgress,
              module_auto_completed: false
            } as MarkContentAsCompletedResponse;
          }
        } catch (e) {
          existingProgress = null;
        }

        const tempProgress = {
          id: progress_id,
          enrollment_id: enrollment.id,
          content_id: contentId,
          is_completed: true,
          viewed_at: existingProgress?.viewed_at || new Date().toISOString(),
          completed_at: new Date().toISOString(),
          created_at: existingProgress?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.db.saveContentProgress(tempProgress);
        await this.db.addToSyncQueue('create', 'content_progress', tempProgress.id,
          { content_id: contentId, completed: true });

        return {
          message: 'Content marked as completed (offline) - Will sync when online',
          progress: tempProgress,
          module_auto_completed: false
        } as MarkContentAsCompletedResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to mark content as completed offline.');
        return throwError(() => error);
      })
    );
  }

  private getModuleResumeDataOffline(moduleId: string): Observable<GetModuleResumeDataResponse> {
    return from(
      this.db.getCurrentUser().then(async user => {
        const content = await this.db.getModuleContent(moduleId);
        const enrollments = await this.db.getUserEnrollments(user.id);
        const module = await this.db.getModuleById(moduleId);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found for this module');
        }

        const contentProgress = await this.db.getContentProgress(enrollment.id);
        const contentIds = content.map((c: any) => c.id);
        const completedContentIds = contentProgress
          .filter((cp: any) => cp.is_completed && contentIds.includes(cp.content_id))
          .map((cp: any) => cp.content_id);

        const nextIncompleteContent = content.find((c: any) => !completedContentIds.includes(c.id));

        return {
          next_incomplete_content_id: nextIncompleteContent?.id,
          completed_content_count: completedContentIds.length,
          total_content_count: content.length,
          completion_percentage: content.length > 0
            ? (completedContentIds.length / content.length) * 100
            : 0
        } as GetModuleResumeDataResponse;
      })
    ).pipe(
      catchError(error => {
        this.toasts.error('Unable to load module progress offline.');
        return throwError(() => error);
      })
    );
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async saveCourseToLocal(course: any): Promise<void> {
    try {
      const courseToSave = {
        id: course.id,
        title: course.title,
        description: course.description || null,
        image_id: null,
        created_by: course.created_by || null,
        is_published: course.is_published ?? true,
        module_count: course.module_count || 0,
        enrollment_count: course.enrollment_count || 0,
        category: course.category || null,
        level: course.level || null,
        duration: course.duration || 0,
        created_at: course.created_at || new Date().toISOString(),
        updated_at: course.updated_at || new Date().toISOString()
      };

      await this.db.saveCourse(courseToSave);
    } catch (error) {
      // Silent fail for caching
    }
  }
}
