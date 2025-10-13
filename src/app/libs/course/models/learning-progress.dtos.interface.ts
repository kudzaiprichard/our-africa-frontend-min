// ============================================================================
// CORE DATA STRUCTURES (Building Blocks)
// ============================================================================

export interface ModuleProgressBasic {
  id: string;
  enrollment_id: string;
  module_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleWithProgress {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  order: number;
  content_count: number;
  has_quiz: boolean;
  created_at: string;
  updated_at: string;
  progress: ModuleProgressBasic;
  is_locked: boolean;
  quiz_status?: 'not_started' | 'in_progress' | 'passed' | 'failed';
}

export interface ContentBlockForStudent {
  id: string;
  module_id: string;
  title?: string;
  content_data: any;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface QuizForStudent {
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
  student_best_score?: number;
  student_attempts_count: number;
  student_can_attempt: boolean;
  student_passed: boolean;
}

export interface QuestionOptionForStudent {
  id: string;
  question_id: string;
  option_text: string;
  order: number;
}

export interface QuestionForQuizAttempt {
  id: string;
  quiz_id: string;
  question_text: string;
  image_url?: string;
  order: number;
  points: number;
  options: QuestionOptionForStudent[];
}

export interface QuestionOptionWithCorrectAnswer {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order: number;
}

export interface QuestionWithAnswerResult {
  id: string;
  quiz_id: string;
  question_text: string;
  image_url?: string;
  order: number;
  points: number;
  options: QuestionOptionWithCorrectAnswer[];
  student_selected_option_id?: string;
  correct_option_id: string;
  is_correct: boolean;
  points_earned: number;
}

export interface QuizAttemptBasic {
  id: string;
  student_id: string;
  quiz_id: string;
  attempt_number: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at?: string;
  score?: number;
  passed?: boolean;
  time_remaining_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface QuizAnswerBasic {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
  points_earned: number;
  created_at: string;
  updated_at: string;
}

export interface CourseBasicForProgress {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  module_count: number;
  categories: string[];
  categories_display: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
}

export interface EnrollmentBasicForProgress {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at?: string;
}

export interface EnrollmentWithCourseAndProgressSummary {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at?: string;
  course: CourseBasicForProgress;
  completed_modules: number;
  total_modules: number;
  completion_percentage: number;
  last_accessed_at?: string;
  next_module_id?: string;
}

// ============================================================================
// MODULE CONTENT ACCESS
// ============================================================================

export interface GetModuleContentForStudentRequest {
  module_id: string;
}

export interface GetModuleContentForStudentResponse {
  module: ModuleWithProgress;
  content: ContentBlockForStudent[];
  quiz?: QuizForStudent;
}

export interface MarkModuleAsStartedRequest {
  module_id: string;
}

export interface MarkModuleAsStartedResponse {
  message: string;
  progress: ModuleProgressBasic;
}

export interface MarkModuleAsCompletedRequest {
  module_id: string;
}

export interface MarkModuleAsCompletedResponse {
  message: string;
  progress: ModuleProgressBasic;
  course_completed: boolean;
  next_module_id?: string;
}

// ============================================================================
// QUIZ ATTEMPT OPERATIONS
// ============================================================================

export interface StartQuizAttemptRequest {
  quiz_id: string;
}

export interface StartQuizAttemptResponse {
  message: string;
  attempt: QuizAttemptBasic;
  quiz: QuizForStudent;
  questions: QuestionForQuizAttempt[];
}

export interface GetAttemptQuestionsRequest {
  attempt_id: string;
}

export interface GetAttemptQuestionsResponse {
  attempt: QuizAttemptBasic;
  quiz: QuizForStudent;
  questions: QuestionForQuizAttempt[];
  submitted_answers: { [question_id: string]: string };
}

export interface SubmitQuizAnswerRequest {
  attempt_id: string;
  question_id: string;
  selected_option_id: string;
}

export interface SubmitQuizAnswerResponse {
  message: string;
  answer: QuizAnswerBasic;
  answers_submitted: number;
  total_questions: number;
}

export interface CompleteQuizAttemptRequest {
  attempt_id: string;
}

export interface CompleteQuizAttemptResponse {
  message: string;
  attempt: QuizAttemptBasic;
  quiz: QuizForStudent;
  score: number;
  passed: boolean;
  total_questions: number;
  correct_answers: number;
  points_earned: number;
  points_possible: number;
  can_retake: boolean;
  next_attempt_available_at?: string;
}

export interface GetQuizResultsRequest {
  attempt_id: string;
}

export interface GetQuizResultsResponse {
  attempt: QuizAttemptBasic;
  quiz: QuizForStudent;
  questions_with_answers: QuestionWithAnswerResult[];
  score: number;
  passed: boolean;
}

export interface GetQuizAttemptsRequest {
  quiz_id: string;
}

export interface GetQuizAttemptsResponse {
  quiz: QuizForStudent;
  attempts: QuizAttemptBasic[];
  best_score?: number;
  remaining_attempts?: number;
  next_attempt_available_at?: string;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export interface GetCourseProgressRequest {
  course_id: string;
}

export interface GetCourseProgressResponse {
  course: CourseBasicForProgress;
  enrollment: EnrollmentBasicForProgress;
  modules_progress: ModuleWithProgress[];
  completion_percentage: number;
  completed_modules: number;
  total_modules: number;
  next_module_id?: string;
  can_take_final_exam: boolean;
  final_exam_status?: 'not_started' | 'in_progress' | 'passed' | 'failed';
}

export interface GetStudentDashboardResponse {
  active_enrollments: EnrollmentWithCourseAndProgressSummary[];
  completed_courses: EnrollmentWithCourseAndProgressSummary[];
  in_progress_courses: EnrollmentWithCourseAndProgressSummary[];
  total_courses: number;
  total_completed: number;
  total_in_progress: number;
  continue_learning?: EnrollmentWithCourseAndProgressSummary;
}
