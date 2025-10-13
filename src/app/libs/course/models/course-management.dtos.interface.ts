// ============================================================================
// CORE DATA STRUCTURES (Building Blocks)
// ============================================================================

export interface CourseBasic {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  is_published: boolean;
  module_count: number;
  enrollment_count: number;
  categories: string[];
  categories_display: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface CourseFull {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  image_file_id?: string;
  created_by: string;
  is_published: boolean;
  module_count: number;
  enrollment_count: number;
  categories: string[];
  categories_display: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface PrerequisiteCourseBasic {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  categories: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
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
  title?: string;
  content_data: any; // JSON structure with blocks array
  order: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionOptionBasic {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order: number;
}

export interface QuestionWithOptions {
  id: string;
  quiz_id: string;
  question_text: string;
  image_url?: string;
  image_file_id?: string;
  order: number;
  points: number;
  options: QuestionOptionBasic[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// COURSE SHELL CREATION
// ============================================================================

export interface CreateCourseShellRequest {
  title: string;
  description?: string;
  banner_image_file?: any;
  prerequisite_course_ids: string[];
  is_published: boolean;
  categories: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
}

export interface CreateCourseShellResponse {
  message: string;
  course: CourseFull;
  next_step: string;
}

// ============================================================================
// COURSE BUILDER STATE
// ============================================================================

export interface CourseBuilderStateRequest {
  course_id: string;
}

export interface CourseBuilderStateResponse {
  course: CourseFull;
  modules_count: number;
  total_content_blocks: number;
  quizzes_count: number;
  total_questions: number;
  has_final_exam: boolean;
  is_ready_to_publish: boolean;
  missing_items: string[];
  checklist: any;
  warnings: string[];
}

// ============================================================================
// COURSE CRUD OPERATIONS
// ============================================================================

export interface UpdateCourseRequest {
  course_id: string;
  title?: string;
  description?: string;
  banner_image_file?: any;
  categories?: string[];
  level?: 'beginner' | 'intermediate' | 'advanced';
  duration?: number;
}

export interface UpdateCourseResponse {
  message: string;
  course: CourseFull;
}

export interface DeleteCourseRequest {
  course_id: string;
}

export interface DeleteCourseResponse {
  message: string;
}

export interface GetCourseRequest {
  course_id: string;
}

export interface GetCourseResponse {
  course: CourseFull;
  final_exam?: QuizBasic;
}

export interface GetAllCoursesRequest {
  page?: number;
  per_page?: number;
  published_only?: boolean;
}

export interface GetAllCoursesResponse {
  courses: CourseBasic[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface GetAvailableCoursesForPrerequisitesRequest {
  exclude_course_id?: string;
}

export interface GetAvailableCoursesForPrerequisitesResponse {
  courses: CourseBasic[];
}

export interface PublishCourseRequest {
  course_id: string;
  is_published: boolean;
}

export interface PublishCourseResponse {
  message: string;
  course: CourseFull;
}

// ============================================================================
// COURSE PREREQUISITE OPERATIONS
// ============================================================================

export interface AddPrerequisiteRequest {
  course_id: string;
  prerequisite_course_id: string;
}

export interface AddPrerequisiteResponse {
  message: string;
  prerequisite: CoursePrerequisiteWithDetails;
}

export interface RemovePrerequisiteRequest {
  prerequisite_id: string;
}

export interface RemovePrerequisiteResponse {
  message: string;
}

export interface GetPrerequisitesRequest {
  course_id: string;
}

export interface GetPrerequisitesResponse {
  prerequisites: CoursePrerequisiteWithDetails[];
}

export interface SyncCoursePrerequisitesRequest {
  course_id: string;
  prerequisite_course_ids: string[];
}

export interface SyncCoursePrerequisitesResponse {
  message: string;
  added_count: number;
  removed_count: number;
}

// ============================================================================
// MODULE OPERATIONS
// ============================================================================

export interface AddModuleToCourseRequest {
  course_id: string;
  title: string;
  description?: string;
  order?: number;
}

export interface AddModuleToCourseResponse {
  message: string;
  module: ModuleBasic;
  next_step: string;
}

export interface UpdateModuleRequest {
  module_id: string;
  title?: string;
  description?: string;
  order?: number;
}

export interface UpdateModuleResponse {
  message: string;
  module: ModuleBasic;
}

export interface DeleteModuleRequest {
  module_id: string;
}

export interface DeleteModuleResponse {
  message: string;
}

export interface GetModuleRequest {
  module_id: string;
}

export interface GetModuleResponse {
  module: ModuleBasic;
  quiz?: QuizBasic;
}

export interface GetCourseModulesRequest {
  course_id: string;
}

export interface GetCourseModulesResponse {
  modules: ModuleBasic[];
}

// ============================================================================
// MODULE CONTENT OPERATIONS
// ============================================================================

export interface AddContentBlockRequest {
  module_id: string;
  title?: string;
  content_data: any;
  order?: number;
}

export interface AddContentBlockResponse {
  message: string;
  content: ContentBlockBasic;
}

export interface UpdateContentBlockRequest {
  content_id: string;
  title?: string;
  content_data?: any;
  order?: number;
}

export interface UpdateContentBlockResponse {
  message: string;
  content: ContentBlockBasic;
}

export interface DeleteModuleContentRequest {
  content_id: string;
}

export interface DeleteModuleContentResponse {
  message: string;
}

export interface GetModuleContentRequest {
  module_id: string;
}

export interface GetModuleContentResponse {
  content: ContentBlockBasic[];
}

// ============================================================================
// QUIZ OPERATIONS
// ============================================================================

export interface CreateQuizShellRequest {
  title: string;
  quiz_type: 'module_quiz' | 'final_exam';
  module_id?: string;
  course_id?: string;
  description?: string;
  time_limit_minutes?: number;
  pass_mark_percentage: number;
  max_attempts?: number;
  attempt_reset_hours: number;
  shuffle_questions: boolean;
}

export interface CreateQuizShellResponse {
  message: string;
  quiz: QuizBasic;
  next_step: string;
}

export interface UpdateQuizRequest {
  quiz_id: string;
  title?: string;
  description?: string;
  time_limit_minutes?: number;
  pass_mark_percentage?: number;
  max_attempts?: number;
  attempt_reset_hours?: number;
  shuffle_questions?: boolean;
}

export interface UpdateQuizResponse {
  message: string;
  quiz: QuizBasic;
}

export interface DeleteQuizRequest {
  quiz_id: string;
}

export interface DeleteQuizResponse {
  message: string;
}

export interface GetQuizRequest {
  quiz_id: string;
}

export interface GetQuizResponse {
  quiz: QuizBasic;
}

// ============================================================================
// QUESTION OPERATIONS
// ============================================================================

export interface QuestionOptionDTO {
  option_text: string;
  is_correct: boolean;
  order: number;
}

export interface AddQuestionToQuizRequest {
  quiz_id: string;
  question_text: string;
  options: QuestionOptionDTO[];
  question_image_file?: any;
  points: number;
  order?: number;
}

export interface AddQuestionToQuizResponse {
  message: string;
  question: QuestionWithOptions;
  options_created: number;
}

export interface DeleteQuestionRequest {
  question_id: string;
}

export interface DeleteQuestionResponse {
  message: string;
}

export interface GetQuizQuestionsRequest {
  quiz_id: string;
}

export interface GetQuizQuestionsResponse {
  questions: QuestionWithOptions[];
}

// ============================================================================
// REORDER OPERATIONS
// ============================================================================

export interface ReorderItemsRequest {
  item_type: 'module' | 'content' | 'question';
  item_orders: Array<{id: string; order: number}>;
}

export interface ReorderItemsResponse {
  message: string;
  items_updated: number;
}

// ============================================================================
// CONTENT BLOCK DTO FOR RICH TEXT EDITOR
// ============================================================================

export interface ContentBlockDTO {
  type: 'heading' | 'paragraph' | 'code' | 'image' | 'math' | 'list' | 'callout';
  content?: string;
  level?: number;
  language?: string;
  showLineNumbers?: boolean;
  filename?: string;
  url?: string;
  file_id?: string;
  caption?: string;
  alt?: string;
  mode?: 'inline' | 'block';
  items?: string[];
  listType?: 'bullet' | 'numbered';
  style?: 'info' | 'warning' | 'success' | 'error';
}
