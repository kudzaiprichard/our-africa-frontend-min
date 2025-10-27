

// ============================================================================
// OFFLINE SESSION MANAGEMENT
// ============================================================================

import {
  ContentBlockBasic,
  CourseFull,
  CoursePrerequisiteWithDetails,
  ModuleBasic,
  QuizBasic
} from './course-management.dtos.interface';
import {QuestionForQuizAttempt} from './learning-progress.dtos.interface';

export interface OfflineSessionBasic {
  id: string;
  student_id: string;
  course_id: string;
  downloaded_at: string;
  expires_at: string;
  package_version: string;
  presigned_url_expiry_days: number;
  last_synced_at?: string;
  sync_count: number;
  is_expired: boolean;
  is_valid: boolean;
  created_at: string;
  updated_at: string;
}

export interface OfflineSessionInfo {
  session_id: string;
  student_id: string;
  course_id: string;
  course_title?: string;
  downloaded_at: string;
  expires_at: string;
  is_valid: boolean;
}

// ============================================================================
// DOWNLOAD COURSE FOR OFFLINE
// ============================================================================

export interface DownloadCourseForOfflineRequest {
  course_id: string;
  presigned_url_expiry_days?: number;
}

export interface OfflineMediaFile {
  media_id: string;
  filename: string;
  media_type: 'video' | 'audio' | 'image' | 'document';
  download_url: string;
  size_bytes: number;
  expires_at: string;
}

export interface OfflineModuleContent {
  module: ModuleBasic;
  content_blocks: ContentBlockBasic[];
  quiz?: QuizBasic;
  quiz_questions?: QuestionForQuizAttempt[];
}

export interface OfflineCoursePackage {
  course: CourseFull;
  modules: OfflineModuleContent[];
  final_exam?: QuizBasic;
  final_exam_questions?: QuestionForQuizAttempt[];
  prerequisites: CoursePrerequisiteWithDetails[];
  media_files: OfflineMediaFile[];
  total_media_size_bytes: number;
  total_media_size_mb: number;
}

export interface DownloadCourseForOfflineResponse {
  message: string;
  offline_session_id: string;
  downloaded_at: string;
  package_version: string;
  course_package: OfflineCoursePackage;
  download_expires_at: string;
  estimated_download_size_mb: number;
}

// ============================================================================
// SYNC OFFLINE PROGRESS
// ============================================================================

export interface ContentOfflineProgress {
  content_id: string;
  is_completed: boolean;
  viewed_at?: string;
  completed_at?: string;
}

export interface QuizAnswerOffline {
  question_id: string;
  selected_option_id: string;
  answered_at?: string;
}

export interface QuizAttemptOffline {
  quiz_id: string;
  started_at: string;
  completed_at?: string;
  status: 'completed' | 'abandoned';
  answers: QuizAnswerOffline[];
}

export interface ModuleOfflineProgress {
  module_id: string;
  started_at?: string;
  completed_at?: string;
  content_progress: ContentOfflineProgress[];
  quiz_attempt?: QuizAttemptOffline;
}

export interface SyncOfflineProgressRequest {
  course_id: string;
  offline_session_id: string;
  downloaded_at: string;
  synced_at: string;
  progress_data: {
    modules_progress: ModuleOfflineProgress[];
    final_exam_attempt?: QuizAttemptOffline;
    last_accessed_module_id?: string;
    total_time_spent_seconds?: number;
  };
}

export interface SyncConflict {
  conflict_type: string;
  item_id: string;
  server_value: any;
  offline_value: any;
  resolution: string;
  reason: string;
}

export interface SyncStatistics {
  content_progresses_synced: number;
  modules_completed: number;
  quiz_attempts_synced: number;
  final_exam_synced: boolean;
  course_completed: boolean;
  conflicts_detected: number;
  conflicts_resolved: number;
}

export interface SyncOfflineProgressResponse {
  message: string;
  sync_successful: boolean;
  statistics: SyncStatistics;
  conflicts: SyncConflict[];
  warnings: string[];
  course_completion_status: string;
  certificates_issued: string[];
  next_recommended_module_id?: string;
}

// ============================================================================
// VALIDATE OFFLINE SESSION
// ============================================================================

export interface ValidateOfflineSessionRequest {
  offline_session_id: string;
  course_id: string;
}

export interface ValidateOfflineSessionResponse {
  is_valid: boolean;
  message: string;
  session_info: OfflineSessionInfo | null;
  can_sync: boolean;
}

// ============================================================================
// MY OFFLINE SESSIONS
// ============================================================================

export interface MyOfflineSessionsResponse {
  sessions: OfflineSessionBasic[];
  total: number;
  active: number;
  expired: number;
}
