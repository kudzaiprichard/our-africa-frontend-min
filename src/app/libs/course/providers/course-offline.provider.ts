import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

// Course Management DTOs
import {
  GetAllCoursesResponse,
  GetCourseResponse,
  GetCourseModulesResponse
} from '../index';

// Enrollment DTOs
import {
  EnrollInCourseResponse,
  UnenrollFromCourseResponse,
  GetStudentEnrollmentsResponse,
  GetEnrollmentDetailsResponse,
  CheckEnrollmentEligibilityResponse,
  GetAvailableCoursesResponse,
  EnrollmentBasic,
  CourseBasicForEnrollment,
  ProgressSummary,
  ModuleSummary,
  EnrollmentWithCourseAndProgress
} from '../index';

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
  ModuleProgressBasic,
  ModuleWithProgress,
  CourseBasicForProgress,
  EnrollmentBasicForProgress,
  EnrollmentWithCourseAndProgressSummary,
  QuizForStudent,
  QuestionWithAnswerResult
} from '../index';
import {TauriDatabaseService} from '../../../theme/shared/services/tauri-database.service';

/**
 * Offline Provider - Handles all local database operations for ENROLLED courses only
 * Uses TauriDatabaseService to interact with SQLite
 *
 * IMPORTANT: This provider only works with courses the student has enrolled in.
 * Browsing new courses requires an internet connection.
 */
@Injectable({
  providedIn: 'root'
})
export class CourseOfflineProvider {

  constructor(private tauriDb: TauriDatabaseService) {}

  // ========== HELPER METHODS ==========

  /**
   * Enhance quiz object with student-specific fields
   */
  private async enhanceQuizForStudent(quizId: string, userId: string): Promise<QuizForStudent> {
    const quiz = await this.tauriDb.getQuizById(quizId);
    const attempts = await this.tauriDb.getQuizAttempts(quizId, userId);
    const bestScore = await this.tauriDb.getBestQuizScore(quizId, userId);

    // Calculate student-specific fields
    const passedAttempts = attempts.filter((a: any) => a.passed === true);
    const studentPassed = passedAttempts.length > 0;

    // Check if can attempt (simplified for offline)
    const inProgressAttempts = attempts.filter((a: any) => a.status === 'in_progress');
    const canAttempt = inProgressAttempts.length === 0 &&
      (!quiz.max_attempts || attempts.length < quiz.max_attempts);

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      quiz_type: quiz.quiz_type,
      module_id: quiz.module_id,
      course_id: quiz.course_id,
      time_limit_minutes: quiz.time_limit_minutes,
      pass_mark_percentage: quiz.pass_mark_percentage,
      max_attempts: quiz.max_attempts,
      attempt_reset_hours: quiz.attempt_reset_hours,
      shuffle_questions: quiz.shuffle_questions,
      question_count: quiz.question_count,
      student_best_score: bestScore || undefined,
      student_attempts_count: attempts.length,
      student_can_attempt: canAttempt,
      student_passed: studentPassed
    } as QuizForStudent;
  }

  /**
   * Enhance module with progress information
   */
  private async enhanceModuleWithProgress(moduleId: string, enrollmentId: string): Promise<ModuleWithProgress> {
    const module = await this.tauriDb.getModuleById(moduleId);
    const moduleProgress = await this.tauriDb.getEnrollmentProgress(enrollmentId);
    const progress = moduleProgress.find((p: any) => p.module_id === moduleId);

    const progressBasic: ModuleProgressBasic = progress ? {
      id: progress.id,
      enrollment_id: progress.enrollment_id,
      module_id: progress.module_id,
      status: progress.status,
      started_at: progress.started_at,
      completed_at: progress.completed_at,
      created_at: progress.created_at,
      updated_at: progress.updated_at
    } : {
      id: `temp_${moduleId}`,
      enrollment_id: enrollmentId,
      module_id: moduleId,
      status: 'not_started',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      id: module.id,
      course_id: module.course_id,
      title: module.title,
      description: module.description,
      order: module.order,
      content_count: module.content_count,
      has_quiz: module.has_quiz,
      created_at: module.created_at,
      updated_at: module.updated_at,
      progress: progressBasic,
      is_locked: false, // Simplified for offline
      quiz_status: progress?.status === 'completed' ? 'passed' : 'not_started'
    } as ModuleWithProgress;
  }

  // ========== COURSE BROWSING & DISCOVERY ==========

  /**
   * Get all published courses (OFFLINE: Returns enrolled courses only)
   */
  getPublishedCourses(page: number = 1, perPage: number = 20): Observable<GetAllCoursesResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const enrollments = await this.tauriDb.getUserEnrollments(user.id);
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
    );
  }

  /**
   * Get courses available for enrollment (OFFLINE: Not supported)
   */
  getAvailableCourses(page: number = 1, perPage: number = 20): Observable<GetAvailableCoursesResponse> {
    return from(
      Promise.reject(new Error(
        'Browsing new courses requires an internet connection. You can access courses you have already enrolled in while offline.'
      ))
    );
  }

  /**
   * Get detailed information about a specific course (OFFLINE: Enrolled courses only)
   */
  getCourseDetails(courseId: string): Observable<GetCourseResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const isEnrolled = await this.tauriDb.checkEnrollmentExists(user.id, courseId);

        if (!isEnrolled) {
          throw new Error(
            'This course is not available offline. You can only access courses you have enrolled in while offline.'
          );
        }

        const course = await this.tauriDb.getCourseById(courseId);

        let finalExam: any | undefined;
        try {
          finalExam = await this.tauriDb.getCourseFinalExam(courseId);
        } catch (error) {
          // No final exam for this course - that's okay
          finalExam = undefined;
        }

        return {
          course,
          final_exam: finalExam
        } as GetCourseResponse;
      })
    );
  }

  /**
   * Get all modules in a course (OFFLINE: Enrolled courses only)
   */
  getCourseModules(courseId: string): Observable<GetCourseModulesResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const isEnrolled = await this.tauriDb.checkEnrollmentExists(user.id, courseId);

        if (!isEnrolled) {
          throw new Error(
            'This course is not available offline. You can only access courses you have enrolled in while offline.'
          );
        }

        const modules = await this.tauriDb.getCourseModules(courseId);

        return {
          modules
        } as GetCourseModulesResponse;
      })
    );
  }

  /**
   * Check if student can enroll in a course (OFFLINE: Not supported)
   */
  checkEnrollmentEligibility(courseId: string): Observable<CheckEnrollmentEligibilityResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const isEnrolled = await this.tauriDb.checkEnrollmentExists(user.id, courseId);

        if (isEnrolled) {
          // Already enrolled, so eligible
          return {
            eligible: true,
            message: 'Already enrolled in this course',
            missing_prerequisites: []
          } as CheckEnrollmentEligibilityResponse;
        } else {
          // Cannot check prerequisites offline
          throw new Error(
            'Checking enrollment eligibility for new courses requires an internet connection. Please go online to enroll in new courses.'
          );
        }
      })
    );
  }

  // ========== ENROLLMENT MANAGEMENT ==========

  /**
   * Get all enrollments for current student (from local DB)
   */
  getMyEnrollments(): Observable<GetStudentEnrollmentsResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const enrollments = await this.tauriDb.getUserEnrollments(user.id);

        const enrollmentsWithProgress: EnrollmentWithCourseAndProgress[] = await Promise.all(
          enrollments.map(async (enrollment: any) => {
            const progressSummary: ProgressSummary = await this.tauriDb.getCourseProgressSummary(enrollment.id);

            const modules = await this.tauriDb.getCourseModules(enrollment.course_id);
            const moduleProgress = await this.tauriDb.getEnrollmentProgress(enrollment.id);

            const completedModuleIds = moduleProgress
              .filter((p: any) => p.status === 'completed')
              .map((p: any) => p.module_id);

            const nextModule = modules.find((m: any) => !completedModuleIds.includes(m.id));

            const canTakeFinalExam = progressSummary.completed_modules === progressSummary.total_modules;

            const nextModuleSummary: ModuleSummary | undefined = nextModule ? {
              id: nextModule.id,
              title: nextModule.title,
              description: nextModule.description,
              order: nextModule.order,
              content_count: nextModule.content_count,
              has_quiz: nextModule.has_quiz
            } : undefined;

            return {
              id: enrollment.id,
              student_id: enrollment.student_id,
              course_id: enrollment.course_id,
              status: enrollment.status,
              enrolled_at: enrollment.enrolled_at,
              completed_at: enrollment.completed_at,
              created_at: enrollment.created_at,
              updated_at: enrollment.updated_at,
              course: enrollment.course as CourseBasicForEnrollment,
              progress: progressSummary,
              next_module: nextModuleSummary,
              can_take_final_exam: canTakeFinalExam
            } as EnrollmentWithCourseAndProgress;
          })
        );

        return {
          enrollments: enrollmentsWithProgress
        } as GetStudentEnrollmentsResponse;
      })
    );
  }

  /**
   * Enroll in a course (OFFLINE: Not supported)
   */
  enrollInCourse(courseId: string): Observable<EnrollInCourseResponse> {
    return from(
      Promise.reject(new Error(
        'Enrolling in new courses requires an internet connection to download course content. Please go online to enroll.'
      ))
    );
  }

  /**
   * Unenroll from a course (OFFLINE: Not supported)
   */
  unenrollFromCourse(courseId: string): Observable<UnenrollFromCourseResponse> {
    return from(
      Promise.reject(new Error(
        'Unenrolling from courses requires an internet connection. Please go online to unenroll.'
      ))
    );
  }

  /**
   * Get detailed enrollment information including progress (from local DB)
   */
  getEnrollmentDetails(courseId: string): Observable<GetEnrollmentDetailsResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const enrollments = await this.tauriDb.getUserEnrollments(user.id);
        const enrollmentWithCourse = enrollments.find((e: any) => e.course_id === courseId);

        if (!enrollmentWithCourse) {
          throw new Error(
            'Enrollment not found. You can only access courses you have enrolled in while offline.'
          );
        }

        const progressSummary: ProgressSummary = await this.tauriDb.getCourseProgressSummary(enrollmentWithCourse.id);

        const { course, ...enrollmentBasic } = enrollmentWithCourse;

        return {
          enrollment: enrollmentBasic as EnrollmentBasic,
          course: course as CourseBasicForEnrollment,
          progress: progressSummary
        } as GetEnrollmentDetailsResponse;
      })
    );
  }

  // ========== LEARNING & MODULE CONTENT ACCESS ==========

  /**
   * Get module content for learning (from local DB - enrolled courses only)
   * ✅ FIXED: Returns ModuleWithProgress and QuizForStudent
   */
  getModuleContent(moduleId: string): Observable<GetModuleContentForStudentResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        // Get module and basic data
        const module = await this.tauriDb.getModuleById(moduleId);

        if (!module) {
          throw new Error(
            'Module content not available offline. Please go online to access this module.'
          );
        }

        const content = await this.tauriDb.getModuleContent(moduleId);

        // Get enrollment to build ModuleWithProgress
        const enrollments = await this.tauriDb.getUserEnrollments(user.id);
        const enrollment = enrollments.find((e: any) => e.course_id === module.course_id);

        if (!enrollment) {
          throw new Error('Enrollment not found for this module.');
        }

        // ✅ Enhance module with progress
        const moduleWithProgress = await this.enhanceModuleWithProgress(moduleId, enrollment.id);

        // ✅ Enhance quiz with student-specific fields (if exists)
        let quizForStudent: QuizForStudent | undefined;
        try {
          const quiz = await this.tauriDb.getModuleQuiz(moduleId);
          if (quiz) {
            quizForStudent = await this.enhanceQuizForStudent(quiz.id, user.id);
          }
        } catch (error) {
          // No quiz for this module
          quizForStudent = undefined;
        }

        return {
          module: moduleWithProgress,
          content,
          quiz: quizForStudent
        } as GetModuleContentForStudentResponse;
      })
    );
  }

  /**
   * Mark module as started (offline - creates temporary progress)
   */
  startModule(moduleId: string): Observable<MarkModuleAsStartedResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const tempProgress: ModuleProgressBasic = {
          id: `temp_progress_${Date.now()}`,
          enrollment_id: 'temp',
          module_id: moduleId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.tauriDb.saveModuleProgress(tempProgress);

        await this.tauriDb.addToSyncQueue(
          'create',
          'module_progress',
          tempProgress.id,
          { module_id: moduleId, status: 'in_progress' }
        );

        return {
          message: 'Module started (offline) - Will sync when online',
          progress: tempProgress
        } as MarkModuleAsStartedResponse;
      })
    );
  }

  /**
   * Mark module as completed (offline - creates temporary progress)
   */
  completeModule(moduleId: string): Observable<MarkModuleAsCompletedResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const tempProgress: ModuleProgressBasic = {
          id: `temp_progress_${Date.now()}`,
          enrollment_id: 'temp',
          module_id: moduleId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.tauriDb.saveModuleProgress(tempProgress);

        await this.tauriDb.addToSyncQueue(
          'create',
          'module_progress',
          tempProgress.id,
          { module_id: moduleId, status: 'completed' }
        );

        return {
          message: 'Module completion queued (offline) - Will sync when online',
          progress: tempProgress,
          course_completed: false
        } as MarkModuleAsCompletedResponse;
      })
    );
  }

  // ========== QUIZ & EXAM MANAGEMENT ==========

  /**
   * Get questions for an existing quiz attempt (from local DB)
   * ✅ FIXED: Returns QuizForStudent
   */
  getAttemptQuestions(attemptId: string): Observable<GetAttemptQuestionsResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const attempt = await this.tauriDb.getQuizAttemptById(attemptId);

        // ✅ Enhance quiz with student fields
        const quiz = await this.enhanceQuizForStudent(attempt.quiz_id, user.id);

        const questions = await this.tauriDb.getQuizQuestions(attempt.quiz_id);
        const answers = await this.tauriDb.getAttemptAnswers(attemptId);

        if (!questions || questions.length === 0) {
          throw new Error(
            'Quiz questions not available offline. Please go online to access this quiz.'
          );
        }

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
    );
  }

  /**
   * Get all attempts for a quiz (from local DB)
   * ✅ FIXED: Returns QuizForStudent with remaining_attempts and next_attempt_available_at
   */
  getQuizAttempts(quizId: string): Observable<GetQuizAttemptsResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        // ✅ Enhance quiz with student fields
        const quiz = await this.enhanceQuizForStudent(quizId, user.id);

        const attempts = await this.tauriDb.getQuizAttempts(quizId, user.id);
        const bestScore = await this.tauriDb.getBestQuizScore(quizId, user.id);

        // ✅ Calculate remaining attempts
        let remainingAttempts: number | undefined;
        if (quiz.max_attempts) {
          remainingAttempts = Math.max(0, quiz.max_attempts - attempts.length);
        }

        // ✅ Calculate next attempt available time (simplified for offline)
        let nextAttemptAvailableAt: string | undefined;
        if (attempts.length > 0 && quiz.attempt_reset_hours > 0) {
          const lastAttempt = attempts[attempts.length - 1];
          if (lastAttempt.completed_at) {
            const lastCompletedDate = new Date(lastAttempt.completed_at);
            const nextAvailableDate = new Date(lastCompletedDate.getTime() + (quiz.attempt_reset_hours * 60 * 60 * 1000));
            nextAttemptAvailableAt = nextAvailableDate.toISOString();
          }
        }

        return {
          quiz,
          attempts,
          best_score: bestScore || undefined,
          remaining_attempts: remainingAttempts,
          next_attempt_available_at: nextAttemptAvailableAt
        } as GetQuizAttemptsResponse;
      })
    );
  }

  /**
   * Get quiz questions for offline use (from local DB)
   * ✅ FIXED: Returns QuizForStudent
   */
  getQuizQuestions(quizId: string): Observable<GetQuizQuestionsForOfflineResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        // ✅ Enhance quiz with student fields
        const quiz = await this.enhanceQuizForStudent(quizId, user.id);

        const questions = await this.tauriDb.getQuizQuestions(quizId);

        if (!questions || questions.length === 0) {
          throw new Error(
            'Quiz questions not available offline. Please go online to access this quiz.'
          );
        }

        return {
          quiz,
          questions
        } as GetQuizQuestionsForOfflineResponse;
      })
    );
  }

  /**
   * Start a new quiz attempt (offline - creates temporary attempt)
   * ✅ FIXED: Returns QuizForStudent
   */
  startQuiz(quizId: string): Observable<StartQuizAttemptResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        // ✅ Enhance quiz with student fields
        const quiz = await this.enhanceQuizForStudent(quizId, user.id);

        const questions = await this.tauriDb.getQuizQuestions(quizId);

        if (!questions || questions.length === 0) {
          throw new Error(
            'Quiz questions not available offline. Please go online to take this quiz.'
          );
        }

        const existingAttempts = await this.tauriDb.getQuizAttempts(quizId, user.id);
        const attemptNumber = existingAttempts.length + 1;

        const tempAttempt = {
          id: `temp_attempt_${Date.now()}`,
          student_id: user.id,
          quiz_id: quizId,
          attempt_number: attemptNumber,
          status: 'in_progress' as const,
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.tauriDb.saveQuizAttempt(tempAttempt);

        await this.tauriDb.addToSyncQueue(
          'create',
          'quiz_attempts',
          tempAttempt.id,
          { quiz_id: quizId }
        );

        return {
          message: 'Quiz attempt created (offline) - Will sync when online',
          attempt: tempAttempt,
          quiz,
          questions
        } as StartQuizAttemptResponse;
      })
    );
  }

  /**
   * Submit answer for a quiz question (offline - saves locally with validation)
   */
  submitQuizAnswer(attemptId: string, request: SubmitQuizAnswerRequest): Observable<SubmitQuizAnswerResponse> {
    return from(
      (async () => {
        const attempt = await this.tauriDb.getQuizAttemptById(attemptId);
        const questions = await this.tauriDb.getQuizQuestions(attempt.quiz_id);
        const question = questions.find((q: any) => q.id === request.question_id);

        if (!question) {
          throw new Error('Question not found');
        }

        // ✅ Find if answer is correct
        const selectedOption = question.options.find((o: any) => o.id === request.selected_option_id);
        const isCorrect = (selectedOption?.is_correct === 1 || selectedOption?.is_correct === true);
        const pointsEarned = isCorrect ? (question.points || 1) : 0;

        // ✅ Create answer object
        const answerToSave = {
          id: `temp_answer_${Date.now()}`,
          attempt_id: attemptId,
          question_id: request.question_id,
          selected_option_id: request.selected_option_id,
          is_correct: isCorrect ? 1 : 0,  // ✅ Always send as integer
          points_earned: pointsEarned,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // ✅ Save to database
        await this.tauriDb.saveQuizAnswer(answerToSave);

        // ✅ Queue for sync
        await this.tauriDb.addToSyncQueue(
          'create',
          'quiz_answers',
          answerToSave.id,
          {
            attempt_id: attemptId,
            question_id: request.question_id,
            selected_option_id: request.selected_option_id,
            is_correct: isCorrect,  // Boolean for API
            points_earned: pointsEarned
          }
        );

        const allQuestions = await this.tauriDb.getQuizQuestions(attempt.quiz_id);
        const answers = await this.tauriDb.getAttemptAnswers(attemptId);

        // ✅ Return DTO with boolean
        return {
          message: 'Answer saved (offline) - Will sync when online',
          answer: {
            id: answerToSave.id,
            attempt_id: answerToSave.attempt_id,
            question_id: answerToSave.question_id,
            selected_option_id: answerToSave.selected_option_id,
            is_correct: isCorrect,  // ✅ Boolean for DTO
            points_earned: answerToSave.points_earned,
            created_at: answerToSave.created_at,
            updated_at: answerToSave.updated_at
          },
          answers_submitted: answers.length,
          total_questions: allQuestions.length
        } as SubmitQuizAnswerResponse;
      })()
    );
  }

  /**
   * Complete and submit quiz attempt (offline - supported with approximate scoring)
   */
  completeQuiz(attemptId: string): Observable<CompleteQuizAttemptResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const attempt = await this.tauriDb.getQuizAttemptById(attemptId);

        // ✅ Get quiz with student fields
        const quiz = await this.enhanceQuizForStudent(attempt.quiz_id, user.id);

        // ✅ Calculate score from answers
        const scoreData = await this.tauriDb.calculateAttemptScore(attemptId);

        // ✅ Map the Rust response correctly
        const score = scoreData.percentage || 0;  // Use 'percentage' from Rust
        const passed = score >= quiz.pass_mark_percentage;

        // ✅ Update attempt with correct score
        await this.tauriDb.updateQuizAttemptStatus(
          attemptId,
          'completed',
          score,
          passed
        );

        // ✅ Queue for sync
        await this.tauriDb.addToSyncQueue(
          'update',
          'quiz_attempts',
          attemptId,
          {
            status: 'completed',
            score: score,
            passed: passed,
            completed_at: new Date().toISOString()
          }
        );

        const completedAttempt = {
          ...attempt,
          status: 'completed' as const,
          score: score,
          passed: passed,
          completed_at: new Date().toISOString()
        };

        return {
          message: 'Quiz completed (offline) - Final score will be validated when online',
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
    );
  }

  /**
   * Get detailed results of a quiz attempt (from local DB)
   */
  getQuizResults(attemptId: string): Observable<GetQuizResultsResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const attempt = await this.tauriDb.getQuizAttemptById(attemptId);
        const quiz = await this.enhanceQuizForStudent(attempt.quiz_id, user.id);
        const questions = await this.tauriDb.getQuizQuestions(attempt.quiz_id);
        const answers = await this.tauriDb.getAttemptAnswers(attemptId);

        const questionsWithAnswers = questions.map((question: any) => {
          const answer = answers.find((a: any) => a.question_id === question.id);
          const correctOption = question.options.find((o: any) => o.is_correct === 1 || o.is_correct === true);

          // ✅ Convert is_correct to boolean (handles 0, 1, false, true, null)
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
              is_correct: opt.is_correct === 1 || opt.is_correct === true,  // ✅ Boolean
              order: opt.order
            })),
            student_selected_option_id: answer?.selected_option_id || undefined,
            correct_option_id: correctOption?.id || '',
            is_correct: isAnswerCorrect,  // ✅ Boolean
            points_earned: answer?.points_earned || 0
          } as QuestionWithAnswerResult;
        });

        let score = attempt.score;
        let passed = attempt.passed;

        if (score === undefined || score === null) {
          const scoreData = await this.tauriDb.calculateAttemptScore(attemptId);
          score = scoreData.percentage || 0;
          passed = score >= quiz.pass_mark_percentage;
        }

        return {
          attempt: {
            ...attempt,
            score: score,
            passed: passed
          },
          quiz,
          questions_with_answers: questionsWithAnswers,
          score: score,
          passed: passed
        } as GetQuizResultsResponse;
      })
    );
  }

// ========== PROGRESS TRACKING & DASHBOARD ==========

  /**
   * Get student dashboard with all enrollments and progress (from local DB)
   * Shows only enrolled courses with offline data
   */
  getStudentDashboard(): Observable<GetStudentDashboardResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        const enrollments = await this.tauriDb.getUserEnrollments(user.id);

        const enrollmentsWithProgress: EnrollmentWithCourseAndProgressSummary[] = await Promise.all(
          enrollments.map(async (enrollment: any) => {
            const progressSummary = await this.tauriDb.getCourseProgressSummary(enrollment.id);

            return {
              id: enrollment.id,
              student_id: enrollment.student_id,
              course_id: enrollment.course_id,
              status: enrollment.status,
              enrolled_at: enrollment.enrolled_at,
              completed_at: enrollment.completed_at,
              course: enrollment.course as CourseBasicForProgress,
              completed_modules: progressSummary.completed_modules,
              total_modules: progressSummary.total_modules,
              completion_percentage: progressSummary.completion_percentage,
              last_accessed_at: progressSummary.last_accessed_at,
              next_module_id: progressSummary.last_accessed_module_id
            } as EnrollmentWithCourseAndProgressSummary;
          })
        );

        // Split by status
        const completedCourses = enrollmentsWithProgress.filter(e => e.status === 'completed');
        const inProgressCourses = enrollmentsWithProgress.filter(e =>
          e.status === 'active' && e.completion_percentage > 0
        );
        const activeCourses = enrollmentsWithProgress.filter(e =>
          e.status === 'active' && e.completion_percentage === 0
        );

        // Find continue learning (most recently accessed)
        const continueLearning = inProgressCourses.sort((a, b) => {
          const dateA = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
          const dateB = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
          return dateB - dateA;
        })[0];

        return {
          active_enrollments: activeCourses,
          completed_courses: completedCourses,
          in_progress_courses: inProgressCourses,
          total_courses: enrollmentsWithProgress.length,
          total_completed: completedCourses.length,
          total_in_progress: inProgressCourses.length,
          continue_learning: continueLearning
        } as GetStudentDashboardResponse;
      })
    );
  }

  /**
   * Get detailed progress for a specific course (from local DB)
   * Shows progress for enrolled courses only
   */
  getCourseProgress(courseId: string): Observable<GetCourseProgressResponse> {
    return from(
      this.tauriDb.getCurrentUser().then(async user => {
        // Get enrollment
        const enrollments = await this.tauriDb.getUserEnrollments(user.id);
        const enrollmentData = enrollments.find((e: any) => e.course_id === courseId);

        if (!enrollmentData) {
          throw new Error(
            'Course progress not available offline. You can only track progress for courses you have enrolled in.'
          );
        }

        // Get course
        const course = await this.tauriDb.getCourseById(courseId);

        // Get modules
        const modules = await this.tauriDb.getCourseModules(courseId);

        // Get progress for each module
        const moduleProgress = await this.tauriDb.getEnrollmentProgress(enrollmentData.id);

        // Build ModuleWithProgress array
        const modulesWithProgress: ModuleWithProgress[] = modules.map((module: any) => {
          const progress = moduleProgress.find((p: any) => p.module_id === module.id);

          const progressBasic: ModuleProgressBasic = progress ? {
            id: progress.id,
            enrollment_id: progress.enrollment_id,
            module_id: progress.module_id,
            status: progress.status,
            started_at: progress.started_at,
            completed_at: progress.completed_at,
            created_at: progress.created_at,
            updated_at: progress.updated_at
          } : {
            id: `temp_${module.id}`,
            enrollment_id: enrollmentData.id,
            module_id: module.id,
            status: 'not_started',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          return {
            id: module.id,
            course_id: module.course_id,
            title: module.title,
            description: module.description,
            order: module.order,
            content_count: module.content_count,
            has_quiz: module.has_quiz,
            created_at: module.created_at,
            updated_at: module.updated_at,
            progress: progressBasic,
            is_locked: false,
            quiz_status: progress?.status === 'completed' ? 'passed' : 'not_started'
          } as ModuleWithProgress;
        });

        // Get progress summary
        const progressSummary = await this.tauriDb.getCourseProgressSummary(enrollmentData.id);

        // Find next module
        const completedModuleIds = moduleProgress
          .filter((p: any) => p.status === 'completed')
          .map((p: any) => p.module_id);
        const nextModule = modules.find((m: any) => !completedModuleIds.includes(m.id));

        // Check final exam status
        const canTakeFinalExam = progressSummary.completed_modules === progressSummary.total_modules;

        // Extract enrollment basic
        const { course: _, ...enrollmentBasic } = enrollmentData;

        return {
          course: course as CourseBasicForProgress,
          enrollment: enrollmentBasic as EnrollmentBasicForProgress,
          modules_progress: modulesWithProgress,
          completion_percentage: progressSummary.completion_percentage,
          completed_modules: progressSummary.completed_modules,
          total_modules: progressSummary.total_modules,
          next_module_id: nextModule?.id,
          can_take_final_exam: canTakeFinalExam,
          final_exam_status: canTakeFinalExam ? 'not_started' : undefined
        } as GetCourseProgressResponse;
      })
    );
  }
}
