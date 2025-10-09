// ============ Enrollment Management Features ============

export interface EnrollInCourseRequest {
  student_id: string;
  course_id: string;
}

export interface EnrollInCourseResponse {
  message: string;
  enrollment: {
    id: string;
    student_id: string;
    course_id: string;
    enrolled_at: string;
    completed_at?: string;
  };
}

export interface UnenrollFromCourseRequest {
  student_id: string;
  course_id: string;
}

export interface UnenrollFromCourseResponse {
  message: string;
}

export interface GetStudentEnrollmentsRequest {
  student_id: string;
}

export interface GetStudentEnrollmentsResponse {
  enrollments: Array<{
    id: string;
    student_id: string;
    course_id: string;
    enrolled_at: string;
    completed_at?: string;
    course: {
      id: string;
      title: string;
      description?: string;
      banner_image_url?: string;
      is_published: boolean;
    };
    progress?: {
      completion_percentage: number;
      completed_modules: number;
      total_modules: number;
    };
  }>;
}

export interface GetEnrollmentDetailsRequest {
  student_id: string;
  course_id: string;
}

export interface GetEnrollmentDetailsResponse {
  enrollment: {
    id: string;
    student_id: string;
    course_id: string;
    enrolled_at: string;
    completed_at?: string;
  };
  course: {
    id: string;
    title: string;
    description?: string;
    banner_image_url?: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
  };
  progress: {
    completion_percentage: number;
    completed_modules: number;
    total_modules: number;
    modules_progress: Array<{
      module_id: string;
      module_title: string;
      status: 'not_started' | 'in_progress' | 'completed';
      started_at?: string;
      completed_at?: string;
    }>;
  };
}

// ============ Enrollment Eligibility Features ============

export interface CheckEnrollmentEligibilityRequest {
  student_id: string;
  course_id: string;
}

export interface CheckEnrollmentEligibilityResponse {
  eligible: boolean;
  message: string;
  missing_prerequisites: Array<{
    id: string;
    title: string;
    description?: string;
    banner_image_url?: string;
  }>;
}

export interface GetAvailableCoursesRequest {
  student_id: string;
  page?: number;
  per_page?: number;
}

export interface GetAvailableCoursesResponse {
  courses: Array<{
    id: string;
    title: string;
    description?: string;
    banner_image_url?: string;
    is_published: boolean;
    created_at: string;
    modules_count: number;
    prerequisites: Array<{
      id: string;
      title: string;
    }>;
    is_enrolled: boolean;
    can_enroll: boolean;
  }>;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
