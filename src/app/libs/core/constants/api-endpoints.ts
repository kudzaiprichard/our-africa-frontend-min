import {environment} from '../../../environments/environment';

/**
 * API endpoints that match backend controller mappings
 */
export const API_ENDPOINTS = {
  BASE_URL: environment.apiUrl,

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

    // Course Browsing & Discovery endpoints
    COURSES: '/api/student/courses',
    COURSES_AVAILABLE: '/api/student/courses/available',
    COURSE_DETAILS: (courseId: string) => `/api/student/courses/${courseId}`,
    COURSE_MODULES: (courseId: string) => `/api/student/courses/${courseId}/modules`,
    COURSE_ELIGIBILITY: (courseId: string) => `/api/student/courses/${courseId}/eligibility`,

    // Enrollment Management endpoints
    ENROLLMENTS: '/api/student/enrollments',
    ENROLL: (courseId: string) => `/api/student/enrollments/${courseId}`,
    UNENROLL: (courseId: string) => `/api/student/enrollments/${courseId}`,
    ENROLLMENT_DETAILS: (courseId: string) => `/api/student/enrollments/${courseId}/details`,

    // Learning & Module Content Access endpoints
    MODULE_CONTENT: (moduleId: string) => `/api/student/modules/${moduleId}/content`,
    MODULE_START: (moduleId: string) => `/api/student/modules/${moduleId}/start`,
    MODULE_COMPLETE: (moduleId: string) => `/api/student/modules/${moduleId}/complete`,

    // Quiz & Exam Management endpoints
    QUIZ_ATTEMPTS: (quizId: string) => `/api/student/quizzes/${quizId}/attempts`,
    QUIZ_START: (quizId: string) => `/api/student/quizzes/${quizId}/start`,
    QUIZ_ANSWER: (attemptId: string) => `/api/student/attempts/${attemptId}/answer`,
    QUIZ_COMPLETE: (attemptId: string) => `/api/student/attempts/${attemptId}/complete`,
    QUIZ_RESULTS: (attemptId: string) => `/api/student/attempts/${attemptId}/results`,

    // Progress Tracking & Dashboard endpoints
    DASHBOARD: '/api/student/dashboard',
    COURSE_PROGRESS: (courseId: string) => `/api/student/courses/${courseId}/progress`
  }

} as const;
