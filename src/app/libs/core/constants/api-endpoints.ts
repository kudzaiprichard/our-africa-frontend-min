import {environment} from '../../../../environments/environment';

/**
 * API endpoints that match backend controller mappings
 */
export const API_ENDPOINTS = {
  BASE_URL: environment.apiUrl,

  // Health check endpoint
  HEALTH: '/api/health',

  // Auth endpoints - matches identity_api_bp Blueprint
  AUTH: {
    BASE: '/api/auth',

    // Email Verification endpoints
    EMAIL_VERIFY_INITIATE: '/api/auth/email/verify/initiate',
    EMAIL_VERIFY_CONFIRM: '/api/auth/email/verify/confirm',
    EMAIL_VERIFY_RESEND: '/api/auth/email/verify/resend',

    // Registration endpoints
    REGISTER_COMPLETE: '/api/auth/register/complete',

    // Authentication endpoints
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH_TOKEN: '/api/auth/refresh-token',

    // Email Change endpoints (Protected)
    EMAIL_CHANGE_INITIATE: '/api/auth/email/change/initiate',
    EMAIL_CHANGE_CONFIRM: '/api/auth/email/change/confirm',

    // User Profile endpoints (Protected)
    PROFILE: '/api/auth/profile',
    CHANGE_PASSWORD: '/api/auth/change-password',
    DEACTIVATE_ACCOUNT: '/api/auth/deactivate'
  },

  STUDENT: {
    BASE: '/api/student',

    // =============================================================================
    // COURSE BROWSING & DISCOVERY
    // =============================================================================

    // GET /api/student/courses
    COURSES: '/api/student/courses',

    // GET /api/student/courses/available
    COURSES_AVAILABLE: '/api/student/courses/available',

    // GET /api/student/courses/<course_id>
    COURSE_DETAILS: (courseId: string) => `/api/student/courses/${courseId}`,

    // GET /api/student/courses/<course_id>/modules
    COURSE_MODULES: (courseId: string) => `/api/student/courses/${courseId}/modules`,

    // GET /api/student/courses/<course_id>/eligibility
    COURSE_ELIGIBILITY: (courseId: string) => `/api/student/courses/${courseId}/eligibility`,

    // =============================================================================
    // ENROLLMENT MANAGEMENT
    // =============================================================================

    // GET /api/student/enrollments
    ENROLLMENTS: '/api/student/enrollments',

    // POST /api/student/enrollments/<course_id>
    ENROLL: (courseId: string) => `/api/student/enrollments/${courseId}`,

    // DELETE /api/student/enrollments/<course_id>
    UNENROLL: (courseId: string) => `/api/student/enrollments/${courseId}`,

    // GET /api/student/enrollments/<course_id>/details
    ENROLLMENT_DETAILS: (courseId: string) => `/api/student/enrollments/${courseId}/details`,

    // =============================================================================
    // LEARNING & MODULE CONTENT ACCESS
    // =============================================================================

    // GET /api/student/modules/<module_id>/content
    MODULE_CONTENT: (moduleId: string) => `/api/student/modules/${moduleId}/content`,

    // POST /api/student/modules/<module_id>/start
    MODULE_START: (moduleId: string) => `/api/student/modules/${moduleId}/start`,

    // POST /api/student/modules/<module_id>/complete
    MODULE_COMPLETE: (moduleId: string) => `/api/student/modules/${moduleId}/complete`,

    // =============================================================================
    // QUIZ & EXAM MANAGEMENT
    // =============================================================================

    // GET /api/student/quizzes/<quiz_id>/questions (for offline download)
    QUIZ_QUESTIONS: (quizId: string) => `/api/student/quizzes/${quizId}/questions`,

    // GET /api/student/quizzes/<quiz_id>/attempts
    QUIZ_ATTEMPTS: (quizId: string) => `/api/student/quizzes/${quizId}/attempts`,

    // POST /api/student/quizzes/<quiz_id>/start
    QUIZ_START: (quizId: string) => `/api/student/quizzes/${quizId}/start`,

    // GET /api/student/attempts/<attempt_id>/questions (for resuming)
    ATTEMPT_QUESTIONS: (attemptId: string) => `/api/student/attempts/${attemptId}/questions`,

    // POST /api/student/attempts/<attempt_id>/answer
    QUIZ_ANSWER: (attemptId: string) => `/api/student/attempts/${attemptId}/answer`,

    // POST /api/student/attempts/<attempt_id>/complete
    QUIZ_COMPLETE: (attemptId: string) => `/api/student/attempts/${attemptId}/complete`,

    QUIZ_ABANDON: (attemptId: string) => `/api/student/attempts/${attemptId}/abandon`,

    // GET /api/student/attempts/<attempt_id>/results
    QUIZ_RESULTS: (attemptId: string) => `/api/student/attempts/${attemptId}/results`,

    // =============================================================================
    // PROGRESS TRACKING & DASHBOARD
    // =============================================================================

    // GET /api/student/dashboard
    DASHBOARD: '/api/student/dashboard',

    // GET /api/student/courses/<course_id>/progress
    COURSE_PROGRESS: (courseId: string) => `/api/student/courses/${courseId}/progress`,

    // =============================================================================
    // CONTENT PROGRESS TRACKING
    // =============================================================================

    // POST /api/student/content/<content_id>/view
    CONTENT_VIEW: (contentId: string) => `/api/student/content/${contentId}/view`,

    // POST /api/student/content/<content_id>/complete
    CONTENT_COMPLETE: (contentId: string) => `/api/student/content/${contentId}/complete`,

    // GET /api/student/modules/<module_id>/resume
    MODULE_RESUME: (moduleId: string) => `/api/student/modules/${moduleId}/resume`,

    // =============================================================================
    // CERTIFICATE MANAGEMENT
    // =============================================================================

    // GET /api/student/certificates
    CERTIFICATES: '/api/student/certificates',

    // GET /api/student/certificates/<certificate_id>
    CERTIFICATE_DETAILS: (certificateId: string) => `/api/student/certificates/${certificateId}`,

    // GET /api/student/certificates/<certificate_id>/download
    CERTIFICATE_DOWNLOAD: (certificateId: string) => `/api/student/certificates/${certificateId}/download`,

    // GET /api/student/certificates/course/<course_id>
    CERTIFICATE_BY_COURSE: (courseId: string) => `/api/student/certificates/course/${courseId}`,

    // POST /api/student/certificates/course/<course_id>/claim - Claim certificate for completed course
    CERTIFICATE_CLAIM: (courseId: string) => `/api/student/certificates/course/${courseId}/claim`,
  }

} as const;
