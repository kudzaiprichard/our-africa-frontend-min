// ============================================================================
// CORE DATA STRUCTURES (Building Blocks)
// ============================================================================

export interface EnrollmentBasic {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseBasicForEnrollment {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  is_published: boolean;
  module_count: number;
  categories: string[];
  categories_display: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
}

export interface ProgressSummary {
  completed_modules: number;
  total_modules: number;
  completion_percentage: number;
  last_accessed_module_id?: string;
  last_accessed_at?: string;
}

export interface ModuleSummary {
  id: string;
  title: string;
  description?: string;
  order: number;
  content_count: number;
  has_quiz: boolean;
}

export interface EnrollmentWithCourse {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  course: CourseBasicForEnrollment;
}

export interface EnrollmentWithCourseAndProgress {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  course: CourseBasicForEnrollment;
  progress: ProgressSummary;
  next_module?: ModuleSummary;
  can_take_final_exam: boolean;
}

export interface PrerequisiteCourseInfo {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  is_completed: boolean;
}

export interface StudentBasicForEnrollment {
  id: string;
  full_name: string;
  email: string;
  profile_image_url?: string;
}

export interface EnrollmentWithStudent {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  student: StudentBasicForEnrollment;
  progress: ProgressSummary;
}

// ============================================================================
// ENROLLMENT OPERATIONS
// ============================================================================

export interface EnrollInCourseRequest {
  course_id: string;
}

export interface EnrollInCourseResponse {
  message: string;
  enrollment: EnrollmentWithCourse;
}

export interface UnenrollFromCourseRequest {
  course_id: string;
}

export interface UnenrollFromCourseResponse {
  message: string;
}

// ============================================================================
// GET STUDENT ENROLLMENTS (Dashboard View)
// ============================================================================

export interface GetStudentEnrollmentsResponse {
  enrollments: EnrollmentWithCourseAndProgress[];
}

// ============================================================================
// GET ENROLLMENT DETAILS (Single Enrollment Deep Dive)
// ============================================================================

export interface GetEnrollmentDetailsRequest {
  course_id: string;
}

export interface GetEnrollmentDetailsResponse {
  enrollment: EnrollmentBasic;
  course: CourseBasicForEnrollment;
  progress: ProgressSummary;
}

// ============================================================================
// CHECK ENROLLMENT ELIGIBILITY (Prerequisites Check)
// ============================================================================

export interface CheckEnrollmentEligibilityRequest {
  course_id: string;
}

export interface CheckEnrollmentEligibilityResponse {
  eligible: boolean;
  message: string;
  missing_prerequisites: PrerequisiteCourseInfo[];
}

// ============================================================================
// GET AVAILABLE COURSES (Course Catalog for Students)
// ============================================================================

export interface GetAvailableCoursesRequest {
  page?: number;
  per_page?: number;
}

export interface GetAvailableCoursesResponse {
  courses: CourseBasicForEnrollment[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================================================
// GET COURSE ENROLLMENTS (Admin View)
// ============================================================================

export interface GetCourseEnrollmentsRequest {
  course_id: string;
  page?: number;
  per_page?: number;
}

export interface GetCourseEnrollmentsResponse {
  enrollments: EnrollmentWithStudent[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
