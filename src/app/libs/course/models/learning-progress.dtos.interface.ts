// ============ Module Content Access Features ============

export interface GetModuleContentForStudentRequest {
  student_id: string;
  module_id: string;
}

export interface GetModuleContentForStudentResponse {
  module: {
    id: string;
    course_id: string;
    title: string;
    description?: string;
    order: number;
    created_at: string;
    updated_at: string;
  };
  content: Array<{
    id: string;
    module_id: string;
    content_type: 'text' | 'image' | 'video';
    text_content?: string;
    image_url?: string;
    video_url?: string;
    caption?: string;
    order: number;
    created_at: string;
  }>;
  progress: {
    id: string;
    student_id: string;
    module_id: string;
    status: 'not_started' | 'in_progress' | 'completed';
    started_at?: string;
    completed_at?: string;
  };
  quiz?: {
    id: string;
    title: string;
    description?: string;
    time_limit_minutes?: number;
    pass_mark_percentage: number;
    max_attempts?: number;
  };
}

export interface MarkModuleAsStartedRequest {
  student_id: string;
  module_id: string;
}

export interface MarkModuleAsStartedResponse {
  message: string;
  progress: {
    id: string;
    student_id: string;
    module_id: string;
    status: string;
    started_at: string;
    completed_at?: string;
  };
}

export interface MarkModuleAsCompletedRequest {
  student_id: string;
  module_id: string;
}

export interface MarkModuleAsCompletedResponse {
  message: string;
  progress: {
    id: string;
    student_id: string;
    module_id: string;
    status: string;
    started_at: string;
    completed_at: string;
  };
}

// ============ Quiz Attempt Features ============

export interface GetQuizAttemptsRequest {
  student_id: string;
  quiz_id: string;
}

export interface GetQuizAttemptsResponse {
  attempts: Array<{
    id: string;
    student_id: string;
    quiz_id: string;
    status: 'in_progress' | 'completed' | 'abandoned';
    score?: number;
    passed?: boolean;
    started_at: string;
    completed_at?: string;
    attempt_number: number;
  }>;
  remaining_attempts?: number;
  next_attempt_available_at?: string;
}

export interface StartQuizAttemptRequest {
  student_id: string;
  quiz_id: string;
}

export interface StartQuizAttemptResponse {
  message: string;
  attempt: {
    id: string;
    student_id: string;
    quiz_id: string;
    status: string;
    started_at: string;
    attempt_number: number;
  };
  questions: Array<{
    id: string;
    quiz_id: string;
    question_text: string;
    question_image_url?: string;
    points: number;
    order: number;
    options: Array<{
      id: string;
      question_id: string;
      option_text: string;
      order: number;
    }>;
  }>;
  time_limit_minutes?: number;
}

export interface SubmitQuizAnswerRequest {
  student_id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string;
}

export interface SubmitQuizAnswerResponse {
  message: string;
  answer: {
    id: string;
    attempt_id: string;
    question_id: string;
    selected_option_id: string;
    answered_at: string;
  };
}

export interface CompleteQuizAttemptRequest {
  student_id: string;
  attempt_id: string;
}

export interface CompleteQuizAttemptResponse {
  message: string;
  attempt: {
    id: string;
    student_id: string;
    quiz_id: string;
    status: string;
    score: number;
    passed: boolean;
    started_at: string;
    completed_at: string;
  };
  score: number;
  passed: boolean;
  total_questions: number;
  correct_answers: number;
}

export interface GetQuizResultsRequest {
  student_id: string;
  attempt_id: string;
}

export interface GetQuizResultsResponse {
  attempt: {
    id: string;
    student_id: string;
    quiz_id: string;
    status: string;
    score: number;
    passed: boolean;
    started_at: string;
    completed_at: string;
  };
  questions_with_answers: Array<{
    question: {
      id: string;
      question_text: string;
      question_image_url?: string;
      points: number;
    };
    selected_option: {
      id: string;
      option_text: string;
      is_correct: boolean;
    };
    correct_option: {
      id: string;
      option_text: string;
    };
    is_correct: boolean;
    points_earned: number;
  }>;
  score: number;
  passed: boolean;
}

// ============ Progress Tracking Features ============

export interface GetStudentDashboardRequest {
  student_id: string;
}

export interface GetStudentDashboardResponse {
  active_enrollments: Array<{
    id: string;
    student_id: string;
    course_id: string;
    enrolled_at: string;
    course: {
      id: string;
      title: string;
      description?: string;
      banner_image_url?: string;
    };
    progress: {
      completion_percentage: number;
      completed_modules: number;
      total_modules: number;
    };
  }>;
  completed_courses: Array<{
    id: string;
    course_id: string;
    completed_at: string;
    course: {
      id: string;
      title: string;
      description?: string;
      banner_image_url?: string;
    };
  }>;
  in_progress_courses: Array<{
    id: string;
    course_id: string;
    enrolled_at: string;
    course: {
      id: string;
      title: string;
      description?: string;
      banner_image_url?: string;
    };
    progress: {
      completion_percentage: number;
      completed_modules: number;
      total_modules: number;
    };
  }>;
  total_courses: number;
  total_completed: number;
}

export interface GetCourseProgressRequest {
  student_id: string;
  course_id: string;
}

export interface GetCourseProgressResponse {
  course: {
    id: string;
    title: string;
    description?: string;
    banner_image_url?: string;
  };
  enrollment: {
    id: string;
    student_id: string;
    course_id: string;
    enrolled_at: string;
    completed_at?: string;
  };
  modules_progress: Array<{
    module: {
      id: string;
      title: string;
      description?: string;
      order: number;
    };
    progress: {
      status: 'not_started' | 'in_progress' | 'completed';
      started_at?: string;
      completed_at?: string;
    };
    quiz_attempts?: Array<{
      id: string;
      score?: number;
      passed?: boolean;
      completed_at?: string;
    }>;
  }>;
  completion_percentage: number;
  completed_modules: number;
  total_modules: number;
}
