import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class TauriDatabaseService {
  private dbPath: string | null = null;

  constructor() {
    this.initializePath();
  }

  /**
   * Get database path from Tauri
   */
  private async initializePath(): Promise<void> {
    try {
      this.dbPath = await invoke<string>('get_database_path');
      console.log('Database path initialized:', this.dbPath);
    } catch (error) {
      console.error('Failed to get database path:', error);
    }
  }

  /**
   * Ensure database path is ready
   */
  private async ensurePath(): Promise<string> {
    if (!this.dbPath) {
      await this.initializePath();
    }
    if (!this.dbPath) {
      throw new Error('Database path not available');
    }
    return this.dbPath;
  }

  // ============================================================================
  // AUTH COMMANDS
  // ============================================================================

  async saveAuthTokens(
    accessToken: string,
    accessExpiresAt: string,
    refreshToken: string,
    refreshExpiresAt: string
  ): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_auth_tokens', {
      dbPath,
      accessToken,
      accessExpiresAt,
      refreshToken,
      refreshExpiresAt
    });
  }

  async getAuthTokens(): Promise<{
    access_token: any | null;
    refresh_token: any | null;
  }> {
    const dbPath = await this.ensurePath();
    const [accessToken, refreshToken] = await invoke<[any | null, any | null]>('get_auth_tokens', { dbPath });
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async clearAuthTokens(): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('clear_auth_tokens', { dbPath });
  }

  async checkTokenExpired(expiresAt: string): Promise<boolean> {
    return invoke<boolean>('check_token_expired', { expiresAt });
  }

  async saveUser(userData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_user', {
      dbPath,
      userData: JSON.stringify(userData)
    });
  }

  async getCurrentUser(): Promise<any> {
    const dbPath = await this.ensurePath();
    const userJson = await invoke<string>('get_current_user', { dbPath });
    return JSON.parse(userJson);
  }

  // ============================================================================
  // COURSE COMMANDS
  // ============================================================================

  async saveCourse(courseData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_course', {
      dbPath,
      courseData: JSON.stringify(courseData)
    });
  }

  async saveCoursesBulk(courses: any[]): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_courses_bulk', {
      dbPath,
      coursesData: JSON.stringify(courses)
    });
  }

  async getAllCourses(): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const coursesJson = await invoke<string>('get_all_courses', { dbPath });
    return JSON.parse(coursesJson);
  }

  async getEnrolledCourses(studentId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const coursesJson = await invoke<string>('get_enrolled_courses', {
      dbPath,
      studentId
    });
    return JSON.parse(coursesJson);
  }

  async getCourseById(courseId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const courseJson = await invoke<string>('get_course_by_id', {
      dbPath,
      courseId
    });
    return JSON.parse(courseJson);
  }

  async saveEnrollment(enrollmentData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_enrollment', {
      dbPath,
      enrollmentData: JSON.stringify(enrollmentData)
    });
  }

  async getUserEnrollments(studentId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const enrollmentsJson = await invoke<string>('get_user_enrollments', {
      dbPath,
      studentId
    });
    return JSON.parse(enrollmentsJson);
  }

  async checkEnrollmentExists(studentId: string, courseId: string): Promise<boolean> {
    const dbPath = await this.ensurePath();
    return invoke<boolean>('check_enrollment_exists', {
      dbPath,
      studentId,
      courseId
    });
  }

  async getCourseFinalExam(courseId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const examJson = await invoke<string>('get_course_final_exam', {
      dbPath,
      courseId
    });
    return JSON.parse(examJson);
  }

  // ============================================================================
  // MODULE COMMANDS
  // ============================================================================

  async saveModule(moduleData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_module', {
      dbPath,
      moduleData: JSON.stringify(moduleData)
    });
  }

  async saveModulesBulk(modules: any[]): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_modules_bulk', {
      dbPath,
      modulesData: JSON.stringify(modules)
    });
  }

  async getCourseModules(courseId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const modulesJson = await invoke<string>('get_course_modules', {
      dbPath,
      courseId
    });
    return JSON.parse(modulesJson);
  }

  async getModuleById(moduleId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const moduleJson = await invoke<string>('get_module_by_id', {
      dbPath,
      moduleId
    });
    return JSON.parse(moduleJson);
  }

  // ============================================================================
  // CONTENT BLOCK COMMANDS
  // ============================================================================

  async saveContentBlock(contentData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_content_block', {
      dbPath,
      contentData: JSON.stringify(contentData)
    });
  }

  async saveContentBlocksBulk(contents: any[]): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_content_blocks_bulk', {
      dbPath,
      contentsData: JSON.stringify(contents)
    });
  }

  async getModuleContent(moduleId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const contentsJson = await invoke<string>('get_module_content', {
      dbPath,
      moduleId
    });
    return JSON.parse(contentsJson);
  }

  async getContentBlockById(contentId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const contentJson = await invoke<string>('get_content_block_by_id', {
      dbPath,
      contentId
    });
    return JSON.parse(contentJson);
  }

  // ============================================================================
  // QUIZ COMMANDS
  // ============================================================================

  async saveQuiz(quizData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_quiz', {
      dbPath,
      quizData: JSON.stringify(quizData)
    });
  }

  async getModuleQuiz(moduleId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const quizJson = await invoke<string>('get_module_quiz', {
      dbPath,
      moduleId
    });
    return JSON.parse(quizJson);
  }

  async getQuizById(quizId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const quizJson = await invoke<string>('get_quiz_by_id', {
      dbPath,
      quizId
    });
    return JSON.parse(quizJson);
  }

  async saveQuestion(questionData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_question', {
      dbPath,
      questionData: JSON.stringify(questionData)
    });
  }

  async saveQuestionsBulk(questions: any[]): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_questions_bulk', {
      dbPath,
      questionsData: JSON.stringify(questions)
    });
  }

  async getQuizQuestions(quizId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const questionsJson = await invoke<string>('get_quiz_questions', {
      dbPath,
      quizId
    });
    return JSON.parse(questionsJson);
  }

  // ============================================================================
  // PROGRESS COMMANDS
  // ============================================================================

  async saveModuleProgress(progressData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_module_progress', {
      dbPath,
      progressData: JSON.stringify(progressData)
    });
  }

  async getEnrollmentProgress(enrollmentId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const progressJson = await invoke<string>('get_enrollment_progress', {
      dbPath,
      enrollmentId
    });
    return JSON.parse(progressJson);
  }

  async updateModuleStatus(moduleProgressId: string, status: string): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('update_module_status', {
      dbPath,
      moduleProgressId,
      status
    });
  }

  async getCourseProgressSummary(enrollmentId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const summaryJson = await invoke<string>('get_course_progress_summary', {
      dbPath,
      enrollmentId
    });
    return JSON.parse(summaryJson);
  }

  async saveQuizAttempt(attemptData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_quiz_attempt', {
      dbPath,
      attemptData: JSON.stringify(attemptData)
    });
  }

  async getQuizAttempts(quizId: string, studentId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const attemptsJson = await invoke<string>('get_quiz_attempts', {
      dbPath,
      quizId,
      studentId
    });
    return JSON.parse(attemptsJson);
  }

  async getQuizAttemptById(attemptId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const attemptJson = await invoke<string>('get_quiz_attempt_by_id', {
      dbPath,
      attemptId
    });
    return JSON.parse(attemptJson);
  }

  async updateQuizAttemptStatus(
    attemptId: string,
    status: string,
    score?: number,
    passed?: boolean
  ): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('update_quiz_attempt_status', {
      dbPath,
      attemptId,
      status,
      score: score || null,
      passed: passed || null
    });
  }

  async saveQuizAnswer(answerData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_quiz_answer', {
      dbPath,
      answerData: JSON.stringify(answerData)
    });
  }

  async getAttemptAnswers(attemptId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const answersJson = await invoke<string>('get_attempt_answers', {
      dbPath,
      attemptId
    });
    return JSON.parse(answersJson);
  }

  async calculateAttemptScore(attemptId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const scoreJson = await invoke<string>('calculate_attempt_score', {
      dbPath,
      attemptId
    });
    return JSON.parse(scoreJson);
  }

  async getBestQuizScore(quizId: string, studentId: string): Promise<number | null> {
    const dbPath = await this.ensurePath();
    return invoke<number | null>('get_best_quiz_score', {
      dbPath,
      quizId,
      studentId
    });
  }

  // ============================================================================
  // SYNC QUEUE COMMANDS
  // ============================================================================

  async addToSyncQueue(
    operationType: 'create' | 'update' | 'delete',
    tableName: string,
    recordId: string,
    data: any
  ): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('add_to_sync_queue', {
      dbPath,
      operationType,
      tableName,
      recordId,
      data: JSON.stringify(data)
    });
  }

  async getSyncQueue(limit?: number): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const queueJson = await invoke<string>('get_sync_queue', {
      dbPath,
      limit: limit || null
    });
    return JSON.parse(queueJson);
  }

  async getSyncQueueCount(): Promise<number> {
    const dbPath = await this.ensurePath();
    return invoke<number>('get_sync_queue_count', { dbPath });
  }

  async removeFromSyncQueue(syncId: number): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('remove_from_sync_queue', { dbPath, syncId });
  }

  async removeMultipleFromSyncQueue(syncIds: number[]): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('remove_multiple_from_sync_queue', {
      dbPath,
      syncIds: JSON.stringify(syncIds)
    });
  }

  async updateSyncQueueRetry(syncId: number, errorMessage?: string): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('update_sync_queue_retry', {
      dbPath,
      syncId,
      errorMessage: errorMessage || null
    });
  }

  async clearSyncQueue(): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('clear_sync_queue', { dbPath });
  }

  async getSyncQueueByTable(tableName: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const queueJson = await invoke<string>('get_sync_queue_by_table', {
      dbPath,
      tableName
    });
    return JSON.parse(queueJson);
  }

  // ============================================================================
  // METADATA COMMANDS
  // ============================================================================

  async setAppMetadata(key: string, value: string): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('set_app_metadata', { dbPath, key, value });
  }

  async getAppMetadata(key: string): Promise<string | null> {
    const dbPath = await this.ensurePath();
    return invoke<string | null>('get_app_metadata', { dbPath, key });
  }

  async getAllAppMetadata(): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const metadataJson = await invoke<string>('get_all_app_metadata', { dbPath });
    return JSON.parse(metadataJson);
  }

  async setLastSyncTime(): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('set_last_sync_time', { dbPath });
  }

  async getLastSyncTime(): Promise<string | null> {
    const dbPath = await this.ensurePath();
    return invoke<string | null>('get_last_sync_time', { dbPath });
  }

  async setOfflineMode(isOffline: boolean): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('set_offline_mode', { dbPath, isOffline });
  }

  async isOfflineMode(): Promise<boolean> {
    const dbPath = await this.ensurePath();
    return invoke<boolean>('is_offline_mode', { dbPath });
  }

  /**
   * Get user by email from local database
   */
  async getUserByEmail(email: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const userJson = await invoke<string>('get_user_by_email', {
      dbPath,
      email
    });
    return JSON.parse(userJson);
  }

  // ============================================================================
  // CONTENT PROGRESS COMMANDS
  // ============================================================================

  /**
   * Save content progress (viewed/completed) to content_progress table
   */
  async saveContentProgress(progressData: any): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('save_content_progress', {
      dbPath,
      progressData: JSON.stringify(progressData)
    });
  }

  /**
   * Get all content progress records for an enrollment
   */
  async getContentProgress(enrollmentId: string): Promise<any[]> {
    const dbPath = await this.ensurePath();
    const progressJson = await invoke<string>('get_content_progress', {
      dbPath,
      enrollmentId
    });
    return JSON.parse(progressJson);
  }

  /**
   * Get content progress for a specific content block
   */
  async getContentProgressByContentId(enrollmentId: string, contentId: string): Promise<any> {
    const dbPath = await this.ensurePath();
    const progressJson = await invoke<string>('get_content_progress_by_content_id', {
      dbPath,
      enrollmentId,
      contentId
    });
    return JSON.parse(progressJson);
  }

  /**
   * Mark content as viewed (helper method)
   */
  async markContentAsViewed(enrollmentId: string, contentId: string): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('mark_content_as_viewed', {
      dbPath,
      enrollmentId,
      contentId
    });
  }

  /**
   * Mark content as completed (helper method)
   */
  async markContentAsCompleted(enrollmentId: string, contentId: string): Promise<string> {
    const dbPath = await this.ensurePath();
    return invoke<string>('mark_content_as_completed', {
      dbPath,
      enrollmentId,
      contentId
    });
  }
}
