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
    // CERTIFICATE GENERATION (NEW)
    // =============================================================================

    CERTIFICATE_GENERATION: {
      // Preview endpoints
      PREVIEW_CERTIFICATE: (courseId: string) => `/api/student/certificate-generation/preview/certificate/${courseId}`,
      PREVIEW_TRANSCRIPT: (courseId: string) => `/api/student/certificate-generation/preview/transcript/${courseId}`,

      // Generate/claim certificate
      GENERATE: (courseId: string) => `/api/student/certificate-generation/generate/${courseId}`,

      // Download certificate/transcript
      DOWNLOAD: (certificateRecordId: string) =>
        `/api/student/certificate-generation/download/${certificateRecordId}`,

      // Retrieval
      MY_CERTIFICATES: '/api/student/certificate-generation/my-certificates',
      RECORD_DETAILS: (certificateRecordId: string) => `/api/student/certificate-generation/record/${certificateRecordId}`,
      BY_COURSE: (courseId: string) => `/api/student/certificate-generation/course/${courseId}`,

      // Eligibility
      ELIGIBILITY: (courseId: string) => `/api/student/certificate-generation/eligibility/${courseId}`,
      ELIGIBILITY_DETAILED: (courseId: string) => `/api/student/certificate-generation/eligibility/${courseId}/detailed`,

      // Statistics
      STATS: '/api/student/certificate-generation/stats'
    },

    // =============================================================================
    // OFFLINE LEARNING
    // =============================================================================

    // POST /api/student/courses/<course_id>/download-offline
    DOWNLOAD_OFFLINE: (courseId: string) => `/api/student/courses/${courseId}/download-offline`,

    // POST /api/student/courses/<course_id>/sync-offline
    SYNC_OFFLINE: (courseId: string) => `/api/student/courses/${courseId}/sync-offline`,

    // GET /api/student/offline-sessions/<session_id>/validate?course_id=<course_id>
    VALIDATE_SESSION: (sessionId: string) => `/api/student/offline-sessions/${sessionId}/validate`,

    // GET /api/student/offline-sessions/my-sessions
    MY_OFFLINE_SESSIONS: '/api/student/offline-sessions/my-sessions',

    // DELETE /api/student/offline-sessions/<session_id>
    DELETE_SESSION: (sessionId: string) => `/api/student/offline-sessions/${sessionId}`,
  },

  // =============================================================================
  // PUBLIC CERTIFICATE VERIFICATION (NO AUTH)
  // =============================================================================

  CERTIFICATES: {
    VERIFY_BY_NUMBER: (certificateNumber: string) => `/api/certificates/verify/number/${certificateNumber}`,
    VERIFY_BY_HASH: (verificationHash: string) => `/api/certificates/verify/hash/${verificationHash}`
  }

} as const;
