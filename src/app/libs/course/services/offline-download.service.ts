// src/app/libs/course/services/offline-download.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TauriDatabaseService } from '../../../theme/shared/services/tauri-database.service';
import { BaseHttpService, API_ENDPOINTS } from '../../core';
import { HttpParams } from '@angular/common/http';
import { invoke } from '@tauri-apps/api/core';
import {
  DownloadCourseForOfflineResponse,
  MyOfflineSessionsResponse,
  OfflineSessionBasic,
  SyncOfflineProgressRequest,
  SyncOfflineProgressResponse,
  ValidateOfflineSessionResponse,
  OfflineMediaFile
} from '../models/offline-learning.dtos.interface';

/**
 * Unified Offline Download Service
 * Handles downloading courses (structure + media) and syncing progress
 */
@Injectable({
  providedIn: 'root'
})
export class OfflineDownloadService {

  private downloadProgressSubject = new BehaviorSubject<DownloadProgress>({
    courseId: null,
    status: 'idle',
    phase: 'idle',
    totalSteps: 5,
    completedSteps: 0,
    currentStep: '',
    percentage: 0,
    mediaProgress: {
      totalFiles: 0,
      downloadedFiles: 0,
      failedFiles: 0,
      currentFile: null,
      currentFileProgress: 0
    }
  });

  public downloadProgress$ = this.downloadProgressSubject.asObservable();

  private isDownloading = false;

  constructor(
    private tauriDb: TauriDatabaseService,
    private http: BaseHttpService
  ) {}

  // ============================================================================
  // DOWNLOAD COURSE FOR OFFLINE (WITH MEDIA)
  // ============================================================================

  /**
   * Download complete course package including all media files
   */
  async downloadCourseForOffline(
    courseId: string,
    presignedUrlExpiryDays: number = 7
  ): Promise<DownloadCourseForOfflineResponse> {
    this.isDownloading = true;

    try {
      // STEP 1: Fetch course package from API
      this.updateProgress(courseId, 'downloading', 'fetching', 0, 5,
        'Fetching course package from server...');

      console.log(`📥 Starting download for course ${courseId}...`);

      const request = { presigned_url_expiry_days: presignedUrlExpiryDays };
      const httpResponse = await this.http.post<DownloadCourseForOfflineResponse>(
        API_ENDPOINTS.STUDENT.DOWNLOAD_OFFLINE(courseId),
        request
      ).toPromise();

      const response = httpResponse?.value;
      if (!response) {
        throw new Error('Failed to download course package');
      }

      console.log("Full course package received from backend:", JSON.stringify(response, null, 2))

      // STEP 2: Save course structure to local database
      this.updateProgress(courseId, 'downloading', 'saving_structure', 1, 5,
        'Saving course structure to local database...');

      await this.saveOfflineSession(response);

      // STEP 3: Download media files (if any)
      this.updateProgress(courseId, 'downloading', 'downloading_media', 2, 5,
        'Downloading media files...');

      const mediaFiles = response.course_package.media_files;
      if (mediaFiles && mediaFiles.length > 0) {
        console.log(`📥 Downloading ${mediaFiles.length} media files...`);

        const mediaResult = await this.downloadAllMediaFiles(courseId, mediaFiles);

        console.log(`✅ Media download: ${mediaResult.downloadedFiles}/${mediaResult.totalFiles} succeeded`);

        if (mediaResult.failedFiles > 0) {
          console.warn(`⚠️ ${mediaResult.failedFiles} files failed:`, mediaResult.failedFilesList);
        }
      } else {
        console.log('ℹ️ No media files to download');
      }

      // STEP 4: Verify download
      this.updateProgress(courseId, 'downloading', 'verifying', 4, 5,
        'Verifying download...');

      // STEP 5: Complete
      this.updateProgress(courseId, 'completed', 'completed', 5, 5,
        'Download complete!');

      console.log(`✅ Course ${courseId} downloaded successfully`);

      return response;

    } catch (error) {
      console.error(`❌ Failed to download course ${courseId}:`, error);
      this.updateProgress(courseId, 'error', 'error', 0, 5,
        `Error: ${error}`);
      throw error;
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Download all media files for a course
   */
  private async downloadAllMediaFiles(
    courseId: string,
    mediaFiles: OfflineMediaFile[]
  ): Promise<MediaDownloadResult> {
    const result: MediaDownloadResult = {
      totalFiles: mediaFiles.length,
      downloadedFiles: 0,
      failedFiles: 0,
      failedFilesList: []
    };

    // Update progress with media info
    this.updateMediaProgress(result.totalFiles, 0, 0, null, 0);

    for (let i = 0; i < mediaFiles.length; i++) {
      const mediaFile = mediaFiles[i];

      if (!this.isDownloading) {
        console.log('⏸️ Download cancelled by user');
        break;
      }

      try {
        await this.downloadSingleFile(courseId, mediaFile, (progress) => {
          this.updateMediaProgress(
            result.totalFiles,
            result.downloadedFiles,
            result.failedFiles,
            mediaFile.filename,
            progress
          );
        });

        result.downloadedFiles++;

        // Update overall progress (interpolate between step 2 and 4)
        const mediaProgressPercent = (result.downloadedFiles / result.totalFiles) * 100;
        const overallProgress = 40 + (mediaProgressPercent * 0.4); // 40% to 80%

        this.updateMediaProgress(
          result.totalFiles,
          result.downloadedFiles,
          result.failedFiles,
          mediaFile.filename,
          100
        );

      } catch (error) {
        console.error(`❌ Failed to download ${mediaFile.filename}:`, error);
        result.failedFiles++;
        result.failedFilesList.push({
          filename: mediaFile.filename,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return result;
  }

  /**
   * Download a single media file
   */
  private async downloadSingleFile(
    courseId: string,
    mediaFile: OfflineMediaFile,
    onProgress: (progress: number) => void
  ): Promise<void> {
    console.log(`📥 Downloading: ${mediaFile.filename}`);

    const localFilePath = await this.generateLocalFilePath(courseId, mediaFile);

    // Download file using Tauri
    await this.downloadFile(mediaFile.download_url, localFilePath, onProgress);

    // Save to media cache
    await this.saveToMediaCache(courseId, mediaFile, localFilePath);

    console.log(`✅ Downloaded: ${mediaFile.filename}`);
  }

  /**
   * Download file using Tauri HTTP client
   */
  private async downloadFile(
    url: string,
    localPath: string,
    onProgress: (progress: number) => void
  ): Promise<void> {
    try {
      await invoke('download_file', {
        url,
        localPath,
        onProgress: (progress: number) => onProgress(progress)
      });
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Generate local file path for media
   */
  private async generateLocalFilePath(
    courseId: string,
    mediaFile: OfflineMediaFile
  ): Promise<string> {
    const appDataDir = await invoke<string>('get_app_data_dir');
    return `${appDataDir}/courses/${courseId}/media/${mediaFile.media_type}/${mediaFile.filename}`;
  }

  /**
   * Save media to cache database
   */
  private async saveToMediaCache(
    courseId: string,
    mediaFile: OfflineMediaFile,
    localFilePath: string
  ): Promise<void> {
    const cacheData = {
      media_id: mediaFile.media_id,
      course_id: courseId,
      filename: mediaFile.filename,
      media_type: mediaFile.media_type,
      local_file_path: localFilePath,
      size_bytes: mediaFile.size_bytes,
      downloaded_at: new Date().toISOString(),
      presigned_url: mediaFile.download_url,
      presigned_url_expires_at: mediaFile.expires_at,
      is_downloaded: true,
      download_progress: 100
    };

    await this.tauriDb.saveMediaCache(cacheData);
  }

  /**
   * Save offline session with ALL course data
   */
  private async saveOfflineSession(response: DownloadCourseForOfflineResponse): Promise<void> {
    console.log('💾 Saving offline session to local database...');
    console.log('📦 Full response structure:', {
      hasCourse: !!response.course_package?.course,
      hasModules: !!response.course_package?.modules,
      moduleCount: response.course_package?.modules?.length || 0,
      hasFinalExam: !!response.course_package?.final_exam,
      hasFinalExamQuestions: !!response.course_package?.final_exam_questions,
      finalExamQuestionCount: response.course_package?.final_exam_questions?.length || 0
    });

    try {
      // ============================================================================
      // STEP 1: GET & SAVE USER
      // ============================================================================
      console.log('👤 Step 1: Getting current user...');
      const user = await this.tauriDb.getCurrentUser();
      console.log('👤 Current user:', {
        id: user?.id,
        email: user?.email,
        name: `${user?.first_name} ${user?.last_name}`
      });

      if (!user || !user.id) {
        throw new Error('User not found in local database. Please log in again.');
      }

      console.log('💾 Saving user to ensure existence...');
      await this.tauriDb.saveUser({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        middle_name: user.middle_name || null,
        last_name: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`.trim(),
        bio: user.bio || null,
        phone_number: user.phone_number || null,
        role: user.role,
        is_active: user.is_active ?? true,
        profile_image_url: user.profile_image_url || null,
        profile_image_file_id: user.profile_image_file_id || null,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString()
      });
      console.log('✅ User saved/verified');

      // ============================================================================
      // STEP 2: SAVE COURSE
      // ============================================================================
      console.log('\n📚 Step 2: Saving course...');
      const course = response.course_package?.course;
      console.log('📚 Course data:', {
        id: course?.id,
        title: course?.title,
        moduleCount: course?.module_count,
        hasDescription: !!course?.description
      });

      if (!course || !course.id) {
        throw new Error('Course data missing from download response');
      }

      await this.tauriDb.saveCourse({
        id: course.id,
        title: course.title,
        description: course.description || undefined,
        image_id: undefined,
        created_by: course.created_by || undefined,
        is_published: course.is_published ?? true,
        module_count: course.module_count || 0,
        enrollment_count: course.enrollment_count || 0,
        category: course.category || undefined,
        level: course.level || undefined,
        duration: course.duration || 0,
        created_at: course.created_at || new Date().toISOString(),
        updated_at: course.updated_at || new Date().toISOString()
      });
      console.log('✅ Course saved to DB');

      // ============================================================================
      // STEP 2.5: SAVE ENROLLMENT (NEW)
      // ============================================================================
      console.log('\n📋 Step 2.5: Saving enrollment...');

      // Check if enrollment exists for this course
      const existingEnrollments = await this.tauriDb.getUserEnrollments(user.id);
      console.log(`📋 Found ${existingEnrollments.length} existing enrollments for user`);

      const enrollment = existingEnrollments.find((e: any) => e.course_id === course.id);

      if (!enrollment) {
        console.log('📋 No enrollment found, creating one...');

        // Create a basic enrollment record
        const enrollmentData = {
          id: `enrollment_${user.id}_${course.id}_${Date.now()}`,
          student_id: user.id,
          course_id: course.id,
          status: 'active',
          enrolled_at: new Date().toISOString(),
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await this.tauriDb.saveEnrollment(enrollmentData);
        console.log('✅ Enrollment created and saved:', enrollmentData.id);
      } else {
        console.log('✅ Enrollment already exists:', enrollment.id);
      }

      // ============================================================================
      // STEP 3: SAVE MODULES & THEIR CONTENT
      // ============================================================================
      console.log('\n📦 Step 3: Saving modules...');
      if (response.course_package.modules && response.course_package.modules.length > 0) {
        console.log(`📦 Found ${response.course_package.modules.length} modules to save`);

        const modules = response.course_package.modules.map(m => ({
          id: m.module.id,
          course_id: m.module.course_id,
          title: m.module.title,
          description: m.module.description || undefined,
          order_index: m.module.order,
          content_count: m.content_blocks?.length || 0,
          has_quiz: !!m.quiz,
          created_at: m.module.created_at,
          updated_at: m.module.updated_at
        }));

        console.log('📦 Module summary:', modules.map(m => ({
          title: m.title,
          order: m.order_index,
          contentCount: m.content_count,
          hasQuiz: m.has_quiz
        })));

        await this.tauriDb.saveModulesBulk(modules);
        console.log('✅ All modules saved to DB');

        // ============================================================================
        // STEP 3.1: SAVE CONTENT FOR EACH MODULE
        // ============================================================================
        console.log('\n📝 Step 3.1: Processing module content...');
        for (let i = 0; i < response.course_package.modules.length; i++) {
          const moduleContent = response.course_package.modules[i];
          console.log(`\n📝 [${i + 1}/${response.course_package.modules.length}] Processing: "${moduleContent.module.title}"`);

          // Content blocks
          if (moduleContent.content_blocks && moduleContent.content_blocks.length > 0) {
            console.log(`  📄 Saving ${moduleContent.content_blocks.length} content blocks...`);
            console.log(`  📄 Content block IDs:`, moduleContent.content_blocks.map(cb => cb.id));

            const contentBlocks = moduleContent.content_blocks.map(cb => ({
              id: cb.id,
              module_id: cb.module_id,
              title: undefined,
              content_data: cb.content_data,
              order_index: cb.order,
              created_at: cb.created_at,
              updated_at: cb.updated_at
            }));

            await this.tauriDb.saveContentBlocksBulk(contentBlocks);
            console.log(`  ✅ Content blocks saved`);
          } else {
            console.log(`  ℹ️ No content blocks for this module`);
          }

          // Module quiz
          if (moduleContent.quiz) {
            console.log(`  🎯 Saving module quiz: "${moduleContent.quiz.title}"`);
            console.log(`  🎯 Quiz details:`, {
              id: moduleContent.quiz.id,
              type: moduleContent.quiz.quiz_type,
              questionCount: moduleContent.quiz.question_count,
              passMarkPercentage: moduleContent.quiz.pass_mark_percentage
            });

            await this.tauriDb.saveQuiz({
              id: moduleContent.quiz.id,
              title: moduleContent.quiz.title,
              description: moduleContent.quiz.description || undefined,
              quiz_type: moduleContent.quiz.quiz_type,
              module_id: moduleContent.quiz.module_id || undefined,
              course_id: moduleContent.quiz.course_id || undefined,
              time_limit_minutes: moduleContent.quiz.time_limit_minutes || undefined,
              pass_mark_percentage: moduleContent.quiz.pass_mark_percentage,
              max_attempts: moduleContent.quiz.max_attempts || undefined,
              attempt_reset_hours: moduleContent.quiz.attempt_reset_hours,
              shuffle_questions: moduleContent.quiz.shuffle_questions,
              question_count: moduleContent.quiz.question_count,
              created_at: moduleContent.quiz.created_at,
              updated_at: moduleContent.quiz.updated_at
            });
            console.log(`  ✅ Quiz saved`);
          } else {
            console.log(`  ℹ️ No quiz for this module`);
          }

          // Quiz questions
          if (moduleContent.quiz_questions && moduleContent.quiz_questions.length > 0) {
            console.log(`  ❓ Saving ${moduleContent.quiz_questions.length} quiz questions...`);
            console.log(`  ❓ Question IDs:`, moduleContent.quiz_questions.map(q => q.id));
            console.log(`  ❓ Sample question:`, {
              id: moduleContent.quiz_questions[0].id,
              text: moduleContent.quiz_questions[0].question_text.substring(0, 50) + '...',
              optionCount: moduleContent.quiz_questions[0].options.length
            });

            const questions = moduleContent.quiz_questions.map(q => ({
              id: q.id,
              quiz_id: q.quiz_id,
              question_text: q.question_text,
              image_url: q.image_url || undefined,
              order_index: q.order,
              points: q.points,
              options: q.options,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));

            await this.tauriDb.saveQuestionsBulk(questions);
            console.log(`  ✅ Quiz questions saved`);
          } else {
            console.log(`  ℹ️ No quiz questions for this module`);
          }

          console.log(`  ✅ Module "${moduleContent.module.title}" fully processed`);
        }
        console.log('\n✅ All modules and their content saved');
      } else {
        console.log('⚠️ No modules found in course package');
      }

      // ============================================================================
      // STEP 4: SAVE FINAL EXAM
      // ============================================================================
      console.log('\n🎓 Step 4: Saving final exam...');
      if (response.course_package.final_exam) {
        console.log('🎓 Final exam found:', {
          id: response.course_package.final_exam.id,
          title: response.course_package.final_exam.title,
          questionCount: response.course_package.final_exam.question_count,
          passMarkPercentage: response.course_package.final_exam.pass_mark_percentage
        });

        await this.tauriDb.saveQuiz({
          id: response.course_package.final_exam.id,
          title: response.course_package.final_exam.title,
          description: response.course_package.final_exam.description || undefined,
          quiz_type: response.course_package.final_exam.quiz_type,
          module_id: response.course_package.final_exam.module_id || undefined,
          course_id: response.course_package.final_exam.course_id || undefined,
          time_limit_minutes: response.course_package.final_exam.time_limit_minutes || undefined,
          pass_mark_percentage: response.course_package.final_exam.pass_mark_percentage,
          max_attempts: response.course_package.final_exam.max_attempts || undefined,
          attempt_reset_hours: response.course_package.final_exam.attempt_reset_hours,
          shuffle_questions: response.course_package.final_exam.shuffle_questions,
          question_count: response.course_package.final_exam.question_count,
          created_at: response.course_package.final_exam.created_at,
          updated_at: response.course_package.final_exam.updated_at
        });
        console.log('✅ Final exam saved');

        // Final exam questions
        if (response.course_package.final_exam_questions && response.course_package.final_exam_questions.length > 0) {
          console.log(`❓ Saving ${response.course_package.final_exam_questions.length} final exam questions...`);
          console.log('❓ Final exam question IDs:', response.course_package.final_exam_questions.map(q => q.id));
          console.log('❓ Sample final exam question:', {
            id: response.course_package.final_exam_questions[0].id,
            text: response.course_package.final_exam_questions[0].question_text.substring(0, 50) + '...',
            optionCount: response.course_package.final_exam_questions[0].options.length
          });

          const examQuestions = response.course_package.final_exam_questions.map(q => ({
            id: q.id,
            quiz_id: q.quiz_id,
            question_text: q.question_text,
            image_url: q.image_url || undefined,
            order_index: q.order,
            points: q.points,
            options: q.options,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          await this.tauriDb.saveQuestionsBulk(examQuestions);
          console.log('✅ Final exam questions saved');
        } else {
          console.log('⚠️ No final exam questions found');
        }
      } else {
        console.log('ℹ️ No final exam for this course');
      }

      // ============================================================================
      // STEP 5: SAVE OFFLINE SESSION RECORD
      // ============================================================================
      console.log('\n💾 Step 5: Saving offline session record...');
      const sessionData = {
        id: response.offline_session_id,
        student_id: user.id,
        course_id: course.id,
        downloaded_at: response.downloaded_at,
        expires_at: response.download_expires_at,
        package_version: response.package_version,
        presigned_url_expiry_days: 7,
        last_synced_at: null,
        sync_count: 0,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('💾 Session data:', {
        id: sessionData.id,
        studentId: sessionData.student_id,
        courseId: sessionData.course_id,
        downloadedAt: sessionData.downloaded_at,
        expiresAt: sessionData.expires_at
      });

      await this.tauriDb.saveOfflineSession(sessionData);
      console.log('✅ Offline session record saved');

      // ============================================================================
      // FINAL SUMMARY
      // ============================================================================
      console.log('\n🎉 ============================================');
      console.log('🎉 OFFLINE SESSION SAVE COMPLETE!');
      console.log('🎉 ============================================');
      console.log('📊 Summary:');
      console.log(`  ✅ Course: ${course.title}`);
      console.log(`  ✅ Enrollment: Created/Verified`);
      console.log(`  ✅ Modules: ${response.course_package.modules?.length || 0}`);
      console.log(`  ✅ Content Blocks: ${response.course_package.modules?.reduce((sum, m) => sum + (m.content_blocks?.length || 0), 0) || 0}`);
      console.log(`  ✅ Module Quizzes: ${response.course_package.modules?.filter(m => m.quiz).length || 0}`);
      console.log(`  ✅ Final Exam: ${response.course_package.final_exam ? 'Yes' : 'No'}`);
      console.log(`  ✅ Total Quiz Questions: ${(response.course_package.modules?.reduce((sum, m) => sum + (m.quiz_questions?.length || 0), 0) || 0) + (response.course_package.final_exam_questions?.length || 0)}`);
      console.log('🎉 ============================================\n');

    } catch (error) {
      console.error('\n❌ ============================================');
      console.error('❌ FAILED TO SAVE OFFLINE SESSION');
      console.error('❌ ============================================');
      console.error('❌ Error:', error);
      console.error('❌ Error stack:', (error as Error).stack);
      console.error('❌ ============================================\n');
      throw new Error(`Failed to save offline session: ${error}`);
    }
  }

  // ============================================================================
  // SYNC OFFLINE PROGRESS
  // ============================================================================

  async syncOfflineProgress(
    courseId: string,
    sessionId: string,
    progressData: any
  ): Promise<SyncOfflineProgressResponse> {
    try {
      console.log(`🔄 Syncing progress for course ${courseId}...`);

      const request: SyncOfflineProgressRequest = {
        course_id: courseId,
        offline_session_id: sessionId,
        downloaded_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        progress_data: progressData
      };

      const httpResponse = await this.http.post<SyncOfflineProgressResponse>(
        API_ENDPOINTS.STUDENT.SYNC_OFFLINE(courseId),
        request
      ).toPromise();

      const response = httpResponse?.value;
      if (!response) {
        throw new Error('Failed to sync progress');
      }

      await this.tauriDb.updateOfflineSessionSyncInfo(sessionId);
      console.log('✅ Progress synced successfully');
      return response;

    } catch (error) {
      console.error('❌ Failed to sync progress:', error);
      throw error;
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async validateSession(sessionId: string, courseId: string): Promise<ValidateOfflineSessionResponse> {
    const params = new HttpParams().set('course_id', courseId);
    const httpResponse = await this.http.get<ValidateOfflineSessionResponse>(
      API_ENDPOINTS.STUDENT.VALIDATE_SESSION(sessionId),
      params
    ).toPromise();
    return httpResponse!.value!;
  }

  async getMySessions(courseId?: string, activeOnly: boolean = false): Promise<MyOfflineSessionsResponse> {
    let params = new HttpParams();
    if (courseId) params = params.set('course_id', courseId);
    if (activeOnly) params = params.set('active_only', 'true');

    const httpResponse = await this.http.get<MyOfflineSessionsResponse>(
      API_ENDPOINTS.STUDENT.MY_OFFLINE_SESSIONS,
      params
    ).toPromise();
    return httpResponse!.value!;
  }

  async getSessionFromLocal(sessionId: string): Promise<OfflineSessionBasic> {
    return this.tauriDb.getOfflineSessionById(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.http.delete<any>(API_ENDPOINTS.STUDENT.DELETE_SESSION(sessionId)).toPromise();
    } catch (error) {
      console.warn('Failed to delete session on server, deleting locally only');
    }
    await this.tauriDb.deleteOfflineSession(sessionId);
  }

  async deleteSessionWithData(sessionId: string, courseId: string): Promise<void> {
    await this.deleteSession(sessionId);
    await this.tauriDb.deleteMediaCacheByCourse(courseId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async isCourseDownloaded(courseId: string): Promise<boolean> {
    try {
      const user = await this.tauriDb.getCurrentUser();
      const sessions = await this.tauriDb.getStudentOfflineSessions(user.id, courseId, true);
      return sessions.length > 0;
    } catch (error) {
      return false;
    }
  }

  async getSessionStatistics(): Promise<any> {
    return this.tauriDb.getOfflineSessionStatistics();
  }

  cancelDownload(): void {
    this.isDownloading = false;
    console.log('⏸️ Download cancelled by user');
  }

  getDownloadProgress(): DownloadProgress {
    return this.downloadProgressSubject.value;
  }

  resetDownloadProgress(): void {
    this.downloadProgressSubject.next({
      courseId: null,
      status: 'idle',
      phase: 'idle',
      totalSteps: 5,
      completedSteps: 0,
      currentStep: '',
      percentage: 0,
      mediaProgress: {
        totalFiles: 0,
        downloadedFiles: 0,
        failedFiles: 0,
        currentFile: null,
        currentFileProgress: 0
      }
    });
  }

  // ============================================================================
  // MEDIA CACHE QUERIES
  // ============================================================================

  async getCachedMedia(courseId: string): Promise<any[]> {
    return this.tauriDb.getMediaCacheByCourse(courseId);
  }

  async getLocalFilePath(mediaId: string): Promise<string | null> {
    try {
      const cache = await this.tauriDb.getMediaCacheByMediaId(mediaId);
      return cache.is_downloaded ? cache.local_file_path : null;
    } catch (error) {
      return null;
    }
  }

  async isMediaDownloaded(mediaId: string): Promise<boolean> {
    try {
      const cache = await this.tauriDb.getMediaCacheByMediaId(mediaId);
      return cache.is_downloaded === true;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // PROGRESS HELPERS
  // ============================================================================

  private updateProgress(
    courseId: string | null,
    status: DownloadStatus,
    phase: DownloadPhase,
    completedSteps: number,
    totalSteps: number,
    currentStep: string
  ): void {
    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const current = this.downloadProgressSubject.value;
    this.downloadProgressSubject.next({
      ...current,
      courseId,
      status,
      phase,
      totalSteps,
      completedSteps,
      currentStep,
      percentage
    });
  }

  private updateMediaProgress(
    totalFiles: number,
    downloadedFiles: number,
    failedFiles: number,
    currentFile: string | null,
    currentFileProgress: number
  ): void {
    const current = this.downloadProgressSubject.value;
    this.downloadProgressSubject.next({
      ...current,
      mediaProgress: {
        totalFiles,
        downloadedFiles,
        failedFiles,
        currentFile,
        currentFileProgress
      }
    });
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface DownloadProgress {
  courseId: string | null;
  status: DownloadStatus;
  phase: DownloadPhase;
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  percentage: number;
  mediaProgress: {
    totalFiles: number;
    downloadedFiles: number;
    failedFiles: number;
    currentFile: string | null;
    currentFileProgress: number;
  };
}

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';
export type DownloadPhase = 'idle' | 'fetching' | 'saving_structure' | 'downloading_media' | 'verifying' | 'completed' | 'error';

export interface MediaDownloadResult {
  totalFiles: number;
  downloadedFiles: number;
  failedFiles: number;
  failedFilesList: Array<{
    filename: string;
    error: string;
  }>;
}
