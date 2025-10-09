// ============ Course Browsing & Discovery Features ============

export interface GetAllCoursesRequest {
  page?: number;
  per_page?: number;
  published_only?: boolean;
}

export interface GetAllCoursesResponse {
  courses: Array<{
    id: string;
    title: string;
    description?: string;
    banner_image_url?: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    modules_count?: number;
    prerequisites?: Array<{
      id: string;
      title: string;
    }>;
  }>;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface GetCourseRequest {
  course_id: string;
  user_id?: string;
}

export interface GetCourseResponse {
  course: {
    id: string;
    title: string;
    description?: string;
    banner_image_url?: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    modules_count?: number;
    total_content_blocks?: number;
  };
  final_exam?: {
    id: string;
    title: string;
    description?: string;
    time_limit_minutes?: number;
    pass_mark_percentage: number;
    max_attempts?: number;
    total_questions: number;
  };
}

export interface GetCourseModulesRequest {
  course_id: string;
}

export interface GetCourseModulesResponse {
  modules: Array<{
    id: string;
    course_id: string;
    title: string;
    description?: string;
    order: number;
    created_at: string;
    updated_at: string;
    content_count?: number;
    has_quiz?: boolean;
    quiz?: {
      id: string;
      title: string;
      total_questions: number;
    };
  }>;
}
