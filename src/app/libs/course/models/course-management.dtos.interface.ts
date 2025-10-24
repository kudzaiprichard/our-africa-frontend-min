// ============================================================================
// COURSE MEDIA INTERFACES
// ============================================================================

export interface CourseMediaBasic {
  id: string;
  file_id: string;
  filename: string;
  media_type: 'video' | 'audio' | 'image' | 'document';
  public_url: string;
  size_bytes?: number;
  uploaded_by: string;
  created_at: string;
}

// ============================================================================
// CORE DATA STRUCTURES (Building Blocks) - STUDENT VIEW
// ============================================================================

export interface CourseBasic {
  id: string;
  title: string;
  description?: string;
  image?: CourseMediaBasic | null;
  is_published: boolean;
  module_count: number;
  enrollment_count: number;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface CourseFull {
  id: string;
  title: string;
  description?: string;
  image?: CourseMediaBasic | null;
  image_id?: string;
  created_by: string;
  is_published: boolean;
  module_count: number;
  enrollment_count: number;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface PrerequisiteCourseBasic {
  id: string;
  title: string;
  description?: string;
  image?: CourseMediaBasic | null;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  duration: number;
}

export interface CoursePrerequisiteWithDetails {
  id: string;
  course_id: string;
  prerequisite_course_id: string;
  prerequisite_course: PrerequisiteCourseBasic;
  created_at: string;
}

export interface ModuleBasic {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  order: number;
  content_count: number;
  has_quiz: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizBasic {
  id: string;
  title: string;
  description?: string;
  quiz_type: 'module_quiz' | 'final_exam';
  module_id?: string;
  course_id?: string;
  time_limit_minutes?: number;
  pass_mark_percentage: number;
  max_attempts?: number;
  attempt_reset_hours: number;
  shuffle_questions: boolean;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContentBlockBasic {
  id: string;
  module_id: string;
  content_data: any; // Tiptap JSON structure
  order: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// COURSE BROWSING & DISCOVERY (STUDENT API)
// ============================================================================

export interface GetAllCoursesRequest {
  page?: number;
  per_page?: number;
  published_only?: boolean;
  category?: string;
  level?: string;
}

export interface GetAllCoursesResponse {
  courses: CourseBasic[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface GetCourseRequest {
  course_id: string;
}

export interface GetCourseResponse {
  course: CourseFull;
  final_exam?: QuizBasic;
}

export interface GetCourseModulesRequest {
  course_id: string;
}

export interface GetCourseModulesResponse {
  modules: ModuleBasic[];
}

// ============================================================================
// MODULE CONTENT (STUDENT API)
// ============================================================================

export interface GetModuleContentRequest {
  module_id: string;
}

export interface GetModuleContentResponse {
  content: ContentBlockBasic[];
}
