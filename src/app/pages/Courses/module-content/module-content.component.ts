import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Node } from '@tiptap/core';

// Updated imports
import { StudentCourseService } from '../../../libs/course';
import {
  GetModuleContentForStudentResponse,
  ModuleWithProgress,
  ContentBlockWithProgress,
  QuizForStudent
} from '../../../libs/course';

interface ParsedContentBlock {
  id: string;
  order: number;
  html?: SafeHtml;
  isCompleted: boolean;
}

@Component({
  selector: 'app-module-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './module-content.component.html',
  styleUrl: './module-content.component.scss'
})
export class ModuleContentComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  moduleId: string = '';
  courseId: string = '';

  module: ModuleWithProgress | null = null;
  content: ContentBlockWithProgress[] = [];
  quiz: QuizForStudent | null = null;
  currentContentIndex: number = 0;
  completedContentIds = new Set<string>();

  // ✅ NEW: Final exam properties
  finalExam: any = null; // Will hold final exam details
  canTakeFinalExam: boolean = false;
  allModulesCompleted: boolean = false;

  isLoading = false;
  error: string | null = null;

  parsedContent: ParsedContentBlock[] = [];

  // Track if we're currently marking content (prevent duplicate calls)
  private isMarkingContent = false;
  // Track last viewed content to prevent duplicate view calls
  private lastViewedContentId: string | null = null;

  // ✅ Cooldown timer properties
  cooldownTimeRemaining: string | null = null;
  private cooldownInterval?: any;

  // Tiptap extensions for generateHTML
  private extensions = [
    StarterKit,
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
    }),
    this.createVideoExtension(),
    this.createAudioExtension(),
    this.createDocumentExtension(),
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentCourseService: StudentCourseService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.moduleId = params['moduleId'];
        this.courseId = params['courseId'];

        if (this.moduleId) {
          this.loadModuleContent();
        } else {
          this.error = 'No module ID provided';
        }
      });
  }

  ngOnDestroy(): void {
    // Only mark as viewed on exit, NOT completed
    // User might have not finished reading
    if (this.currentContent && !this.currentContent.progress?.viewed_at) {
      this.markContentAsViewed(this.currentContent.id);
    }

    // Clear cooldown timer
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  loadModuleContent(): void {
    // Right before this.isLoading = false; (around line 260)
    this.logCompletionState('AFTER LOAD');
    console.log('✅ ========================================');
    console.log('✅ MODULE CONTENT LOAD COMPLETE');
    console.log('✅ ========================================');

    this.isLoading = false;

    this.isLoading = true;
    this.error = null;

    console.log('🔄 ========================================');
    console.log('🔄 Loading module content for moduleId:', this.moduleId);
    console.log('🔄 courseId:', this.courseId);
    console.log('🔄 ========================================');

    // ✅ Load both module content AND course details (for final exam)
    forkJoin({
      moduleContent: this.studentCourseService.getModuleContent(this.moduleId),
      courseDetails: this.studentCourseService.getCourseDetails(this.courseId),
      courseProgress: this.studentCourseService.getCourseProgress(this.courseId)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📦 ========================================');
          console.log('📦 RAW RESPONSE FROM BACKEND');
          console.log('📦 ========================================');
          console.log('📦 moduleContent:', response.moduleContent);
          console.log('📦 courseDetails:', response.courseDetails);
          console.log('📦 courseProgress:', response.courseProgress);

          // Module content data
          this.module = response.moduleContent.module;
          this.content = response.moduleContent.content;
          this.quiz = response.moduleContent.quiz || null;

          console.log('📋 ========================================');
          console.log('📋 PROCESSING CONTENT BLOCKS');
          console.log('📋 ========================================');
          console.log('📋 Total content blocks received:', this.content.length);

          // ✅ DEBUG: Log all content blocks and their progress IN DETAIL
          this.content.forEach((block, index) => {
            console.log(`📋 Content Block ${index + 1}:`, {
              id: block.id,
              order: block.order,
              module_id: block.module_id,
              hasProgress: !!block.progress,
              progressData: block.progress,
              isCompleted: block.progress?.is_completed,
              completedAt: block.progress?.completed_at,
              viewedAt: block.progress?.viewed_at
            });
          });

          // ✅ Final exam data - with type safety fix
          const courseDetailsResponse = response.courseDetails as any;
          this.finalExam = courseDetailsResponse.final_exam || courseDetailsResponse.course?.final_exam || null;

          console.log('🎓 Final exam:', this.finalExam);

          // ✅ Check if all modules are completed
          this.allModulesCompleted = response.courseProgress.completed_modules === response.courseProgress.total_modules;

          console.log('📊 Course Progress:', {
            completedModules: response.courseProgress.completed_modules,
            totalModules: response.courseProgress.total_modules,
            allModulesCompleted: this.allModulesCompleted
          });

          // ✅ Check if can take final exam
          this.canTakeFinalExam = response.courseProgress.can_take_final_exam;

          console.log('🎯 Can take final exam:', this.canTakeFinalExam);

          console.log('✅ ========================================');
          console.log('✅ INITIALIZING COMPLETED CONTENT IDS');
          console.log('✅ ========================================');

          // Initialize completed content IDs from progress data
          this.completedContentIds.clear();
          console.log('🗑️ Cleared completedContentIds set');

          this.content.forEach((block, index) => {
            if (block.progress?.is_completed) {
              this.completedContentIds.add(block.id);
              console.log(`✅ Content Block ${index + 1} marked as COMPLETED:`, {
                id: block.id,
                completedAt: block.progress.completed_at
              });
            } else {
              console.log(`⬜ Content Block ${index + 1} NOT completed:`, {
                id: block.id,
                hasProgress: !!block.progress,
                isCompleted: block.progress?.is_completed
              });
            }
          });

          console.log('📊 ========================================');
          console.log('📊 COMPLETION SUMMARY');
          console.log('📊 ========================================');
          console.log('📊 Completed content IDs after load:', Array.from(this.completedContentIds));
          console.log('📊 Total completed:', this.completedContentIds.size, 'out of', this.content.length);
          console.log('📊 Completion percentage:', this.progressPercentage + '%');

          // ✅ FIX 1: Resume at the correct position
          let startIndex = 0;

          // If resume_content_id is provided, jump to that content
          if (response.moduleContent.resume_content_id) {
            const resumeIndex = this.content.findIndex(c => c.id === response.moduleContent.resume_content_id);
            if (resumeIndex !== -1) {
              startIndex = resumeIndex;
              console.log('🎯 Resuming at content index from backend:', startIndex);
            }
          } else {
            // Find the first incomplete content
            const firstIncompleteIndex = this.content.findIndex((block) =>
              !this.completedContentIds.has(block.id)
            );

            if (firstIncompleteIndex !== -1) {
              // Found incomplete content - start there
              startIndex = firstIncompleteIndex;
              console.log('🎯 Starting at first incomplete content index:', startIndex);
            } else if (this.content.length > 0) {
              // All content completed - start at last content (where quiz would be)
              startIndex = this.content.length - 1;
              console.log('🎯 All content completed - starting at last content index:', startIndex);
            }
          }

          this.currentContentIndex = startIndex;
          console.log('🎯 Final starting content index:', this.currentContentIndex);

          this.parseContent();

          // Mark module as started if not already
          this.markModuleAsStarted();

          // Only track VIEW, not completion
          this.autoTrackContentView();

          // Start cooldown timer if quiz has cooldown
          this.startCooldownTimer();

          this.isLoading = false;

          console.log('✅ ========================================');
          console.log('✅ MODULE CONTENT LOAD COMPLETE');
          console.log('✅ ========================================');
        },
        error: (err) => {
          console.error('❌ ========================================');
          console.error('❌ ERROR LOADING MODULE CONTENT');
          console.error('❌ ========================================');
          console.error('❌ Error:', err);
          console.error('❌ Error details:', {
            message: err.message,
            stack: err.stack
          });

          this.error = 'Failed to load module content';
          this.isLoading = false;
        }
      });
  }

  // ✅ Start cooldown countdown timer
  private startCooldownTimer(): void {
    // Clear existing timer
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }

    // Check if quiz exists and has attempts info
    if (!this.quiz) return;

    // Load quiz attempts to get next_attempt_available_at
    this.studentCourseService.getQuizAttempts(this.quiz.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attemptsResponse) => {
          // Check if cooldown is active
          if (attemptsResponse.next_attempt_available_at &&
            attemptsResponse.remaining_attempts !== undefined &&
            attemptsResponse.remaining_attempts === 0) {

            const nextAttemptDate = new Date(attemptsResponse.next_attempt_available_at);

            // Start countdown
            this.updateCooldownDisplay(nextAttemptDate);

            this.cooldownInterval = setInterval(() => {
              this.updateCooldownDisplay(nextAttemptDate);
            }, 1000);
          } else {
            this.cooldownTimeRemaining = null;
          }
        },
        error: (err) => {
          console.error('Error loading quiz attempts for cooldown:', err);
        }
      });
  }

  // ✅ Update cooldown display
  private updateCooldownDisplay(nextAttemptDate: Date): void {
    const now = new Date();
    const diffMs = nextAttemptDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      // Cooldown expired!
      this.cooldownTimeRemaining = null;

      if (this.cooldownInterval) {
        clearInterval(this.cooldownInterval);
      }

      // Refresh quiz data to enable quiz
      this.loadModuleContent();
      return;
    }

    // Calculate time components
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    // Format display
    if (hours > 0) {
      this.cooldownTimeRemaining = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      this.cooldownTimeRemaining = `${minutes}m ${seconds}s`;
    } else {
      this.cooldownTimeRemaining = `${seconds}s`;
    }
  }

  markModuleAsStarted(): void {
    if (this.module && this.module.progress.status === 'not_started') {
      this.studentCourseService.startModule(this.moduleId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            console.log('Module started:', response);
            // Update local module progress
            if (this.module) {
              this.module.progress = response.progress;
            }
          },
          error: (err) => {
            console.error('Error starting module:', err);
          }
        });
    }
  }

  parseContent(): void {
    this.parsedContent = this.content.map(block => ({
      id: block.id,
      order: block.order,
      html: this.convertTiptapToHtml(block.content_data),
      isCompleted: block.progress?.is_completed || false
    }));
  }

  // ========== CUSTOM TIPTAP EXTENSIONS ==========

  private createVideoExtension() {
    return Node.create({
      name: 'video',
      group: 'block',
      atom: true,
      addAttributes() {
        return {
          src: { default: null },
        };
      },
      parseHTML() {
        return [{ tag: 'video' }];
      },
      renderHTML({ HTMLAttributes }) {
        return ['video', { ...HTMLAttributes, controls: true, class: 'tiptap-video' }];
      },
    });
  }

  private createAudioExtension() {
    return Node.create({
      name: 'audio',
      group: 'block',
      atom: true,
      addAttributes() {
        return {
          src: { default: null },
        };
      },
      parseHTML() {
        return [{ tag: 'audio' }];
      },
      renderHTML({ HTMLAttributes }) {
        return ['audio', { ...HTMLAttributes, controls: true, class: 'tiptap-audio' }];
      },
    });
  }

  // Add this method to your component
  private createDocumentExtension() {
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return Node.create({
      name: 'document',
      group: 'block',
      atom: true,
      addAttributes() {
        return {
          src: { default: null },
          filename: { default: 'Document' },
          filesize: { default: 0 },
          filetype: { default: 'FILE' },
        };
      },
      parseHTML() {
        return [{ tag: 'a.document-card' }];
      },
      renderHTML({ HTMLAttributes }) {
        const { src, filename, filesize, filetype } = HTMLAttributes;
        const formattedSize = formatSize(filesize);

        return [
          'a',
          {
            href: 'javascript:void(0)',  // ✅ Prevent default
            class: 'document-card',
            'data-pdf-url': src,
            'data-pdf-name': filename
          },
          ['div', { class: 'document-icon' }, ['i', { class: 'fas fa-file' }]],
          [
            'div',
            { class: 'document-info' },
            ['div', { class: 'document-name' }, filename],
            [
              'div',
              { class: 'document-meta' },
              ['span', { class: 'document-type' }, filetype],
              ['span', '•'],
              ['span', formattedSize],
            ],
          ],
        ];
      },
    });
  }

  ngAfterViewInit(): void {
    // Set up global click listener
    document.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('.document-card');
      if (target) {
        e.preventDefault(); // Prevent any default action

        const url = target.getAttribute('data-pdf-url');
        const name = target.getAttribute('data-pdf-name');

        console.log('📄 Document card clicked!', { url, name }); // Debug log

        if (url) {
          await this.openPdfInWindow(url, name || 'Document');
        }
      }
    });
  }

// Update this method with better error handling
  private async openPdfInWindow(url: string, title: string): Promise<void> {
    console.log('🔍 openPdfInWindow called', { url, title });

    try {
      // Check if in Tauri
      if (typeof (window as any).__TAURI__ !== 'undefined') {
        console.log('✅ Running in Tauri');

        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

        console.log('📦 WebviewWindow imported');

        // Create new window with PDF
        const webview = new WebviewWindow(`pdf-${Date.now()}`, {
          url: url,
          title: title,
          width: 1200,
          height: 800,
          center: true,
          resizable: true
        });

        console.log('🪟 WebviewWindow created', webview);

        // Listen for errors
        webview.once('tauri://error', (e) => {
          console.error('❌ Webview error:', e);
        });

      } else {
        console.log('🌐 Running in browser, using window.open');
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('❌ Error opening PDF:', error);
      // Fallback to browser open
      console.log('🔄 Falling back to window.open');
      window.open(url, '_blank');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ========== CONVERT TIPTAP JSON TO HTML ==========

  convertTiptapToHtml(tiptapData: any): SafeHtml {
    if (!tiptapData) {
      return '';
    }

    try {
      const html = generateHTML(tiptapData, this.extensions);
      console.log('✅ Content converted successfully');
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (error) {
      console.error('❌ Error converting Tiptap to HTML:', error);
      return '';
    }
  }

  get currentParsedContent(): ParsedContentBlock | null {
    return this.parsedContent[this.currentContentIndex] || null;
  }

  get currentContent(): ContentBlockWithProgress | null {
    return this.content[this.currentContentIndex] || null;
  }

  get moduleTitle(): string {
    return this.module?.title || '';
  }

  get moduleDescription(): string | undefined {
    return this.module?.description;
  }

  get totalContents(): number {
    return this.content.length;
  }

  get completedContents(): number {
    return this.completedContentIds.size;
  }

  get progressPercentage(): number {
    if (this.totalContents === 0) return 0;
    return Math.round((this.completedContents / this.totalContents) * 100);
  }

  // /**
  //  * ✅ UPDATED: Check if student can take the quiz
  //  * Quiz unlocks when:
  //  * 1. All previous content is completed AND currently on last content, OR
  //  * 2. ALL content is completed (including current)
  //  */
  // get canTakeQuiz(): boolean {
  //   console.log('🔍 ========================================');
  //   console.log('🔍 canTakeQuiz EVALUATION - OFFLINE DEBUG');
  //   console.log('🔍 ========================================');
  //   console.log('🔍 Quiz exists:', !!this.quiz);
  //
  //   if (!this.quiz) {
  //     console.log('❌ No quiz available');
  //     console.log('🔍 ========================================');
  //     return false;
  //   }
  //
  //   console.log('📊 Quiz info:', {
  //     id: this.quiz.id,
  //     title: this.quiz.title,
  //     student_passed: this.quiz.student_passed,
  //     student_can_attempt: this.quiz.student_can_attempt
  //   });
  //
  //   // ✅ Disable quiz if already passed
  //   if (this.quiz.student_passed) {
  //     console.log('❌ Quiz already passed');
  //     console.log('🔍 ========================================');
  //     return false;
  //   }
  //
  //   // Check if has attempts remaining
  //   const hasAttemptsRemaining = this.quiz.student_can_attempt;
  //   console.log('🎫 Has attempts remaining:', hasAttemptsRemaining);
  //
  //   if (!hasAttemptsRemaining) {
  //     console.log('❌ No attempts remaining');
  //     console.log('🔍 ========================================');
  //     return false;
  //   }
  //
  //   const totalContent = this.totalContents;
  //   const completedContent = this.completedContents;
  //
  //   console.log('📈 Content status:', {
  //     totalContent,
  //     completedContent,
  //     isLastContent: this.isLastContent,
  //     currentIndex: this.currentContentIndex
  //   });
  //
  //   console.log('📋 CompletedContentIds Set:', Array.from(this.completedContentIds));
  //   console.log('📋 All content blocks status:');
  //   this.content.forEach((c, i) => {
  //     console.log(`   [${i}] id=${c.id}, hasProgress=${!!c.progress}, is_completed=${c.progress?.is_completed}, inSet=${this.completedContentIds.has(c.id)}`);
  //   });
  //
  //   // ✅ FIX: If on last content, check if all PREVIOUS content is completed
  //   if (this.isLastContent) {
  //     const allPreviousCompleted = completedContent >= (totalContent - 1);
  //     console.log('🎯 On LAST content:');
  //     console.log('   - Total content blocks:', totalContent);
  //     console.log('   - Completed content blocks:', completedContent);
  //     console.log('   - Previous content needed:', totalContent - 1);
  //     console.log('   - All previous completed?', allPreviousCompleted);
  //     console.log('   - Calculation:', `${completedContent} >= ${totalContent - 1}`);
  //     console.log('   - RESULT: QUIZ UNLOCKED =', allPreviousCompleted);
  //     console.log('🔍 ========================================');
  //     return allPreviousCompleted;
  //   }
  //
  //   // Otherwise, require ALL content blocks to be completed
  //   const allContentCompleted = completedContent === totalContent;
  //   console.log('🎯 NOT on last content:');
  //   console.log('   - Total content blocks:', totalContent);
  //   console.log('   - Completed content blocks:', completedContent);
  //   console.log('   - All content completed?', allContentCompleted);
  //   console.log('   - Calculation:', `${completedContent} === ${totalContent}`);
  //   console.log('   - RESULT: QUIZ UNLOCKED =', allContentCompleted);
  //   console.log('🔍 ========================================');
  //
  //   return allContentCompleted;
  // }

  /**
   * ✅ UPDATED: Check if student can take the quiz
   * Quiz unlocks when:
   * 1. All previous content is completed AND currently on last content, OR
   * 2. ALL content is completed (including current)
   */
  get canTakeQuiz(): boolean {
    if (!this.quiz) {
      return false;
    }

    // ✅ Disable quiz if already passed
    if (this.quiz.student_passed) {
      return false;
    }

    // Check if has attempts remaining
    if (!this.quiz.student_can_attempt) {
      return false;
    }

    const totalContent = this.totalContents;
    const completedContent = this.completedContents;

    // ✅ If on last content, check if all PREVIOUS content is completed
    if (this.isLastContent) {
      return completedContent >= (totalContent - 1);
    }

    // Otherwise, require ALL content blocks to be completed
    return completedContent === totalContent;
  }

  /**
   * ✅ DEBUG: Log completion state changes
   */
  private logCompletionState(action: string): void {
    console.log(`\n🔍 ======== COMPLETION STATE: ${action} ========`);
    console.log('📊 completedContentIds:', Array.from(this.completedContentIds));
    console.log('📊 Content blocks:');
    this.content.forEach((c, i) => {
      console.log(`   [${i}] ${c.id}: progress=${!!c.progress}, completed=${c.progress?.is_completed}, inSet=${this.completedContentIds.has(c.id)}`);
    });
    console.log('📊 Total:', this.totalContents, '| Completed:', this.completedContents);
    console.log('📊 Can take quiz:', this.canTakeQuiz);
    console.log('🔍 ========================================\n');
  }

  /**
   * ✅ UPDATED: Get quiz disabled reason
   */
  get quizDisabledReason(): string | null {
    if (!this.quiz) return null;

    // ✅ If quiz is passed, show completion message
    if (this.quiz.student_passed) {
      return 'Quiz completed ✓';
    }

    const totalContent = this.totalContents;
    const completedContent = this.completedContents;

    // ✅ FIX: If on last content, only check attempts and previous completion
    if (this.isLastContent) {
      const allPreviousCompleted = completedContent >= (totalContent - 1);

      if (!allPreviousCompleted) {
        const remaining = (totalContent - 1) - completedContent;
        return `Complete ${remaining} more content block${remaining > 1 ? 's' : ''} to unlock quiz`;
      }

      if (!this.quiz.student_can_attempt) {
        if (this.cooldownTimeRemaining) {
          return `Available in ${this.cooldownTimeRemaining}`;
        }
        return 'No attempts remaining';
      }

      return null; // Quiz is available!
    }

    // If not on last content, check if ALL content is completed
    const allContentCompleted = completedContent === totalContent;

    if (!allContentCompleted) {
      const remaining = totalContent - completedContent;
      return `Complete ${remaining} more content block${remaining > 1 ? 's' : ''} to unlock quiz`;
    }

    if (!this.quiz.student_can_attempt) {
      if (this.cooldownTimeRemaining) {
        return `Available in ${this.cooldownTimeRemaining}`;
      }
      return 'No attempts remaining';
    }

    return null;
  }

  /**
   * Check if we should show "Start Quiz" instead of "Next/Finish"
   */
  get shouldShowStartQuiz(): boolean {
    return !!(this.isLastContent && this.module?.has_quiz && this.quiz && !this.quiz.student_passed);
  }

  /**
   * Get the appropriate button text for navigation
   */
  get nextButtonText(): string {
    if (this.shouldShowStartQuiz) {
      return 'Start Quiz';
    }
    return this.isLastContent ? 'Finish Content' : 'Next Content';
  }

  /**
   * ✅ NEW: Check if should show final exam prompt
   */
  get shouldShowFinalExamPrompt(): boolean {
    return !!(
      this.finalExam &&
      this.canTakeFinalExam &&
      !this.finalExam.student_passed &&
      this.module?.progress.status === 'completed'
    );
  }

  // ========== AUTO-TRACKING METHODS ==========

  /**
   * Only track VIEW when content loads
   * Does NOT mark as completed
   */
  private autoTrackContentView(): void {
    if (!this.currentContent) return;

    const contentId = this.currentContent.id;

    // Prevent duplicate view tracking for same content
    if (this.lastViewedContentId === contentId) {
      return;
    }

    // Only track if not already viewed
    if (!this.currentContent.progress?.viewed_at) {
      this.lastViewedContentId = contentId;

      // Silent background call - don't wait for response
      this.markContentAsViewed(contentId);
    }
  }

  /**
   * Mark content as viewed (silent tracking)
   */
  private markContentAsViewed(contentId: string): void {
    this.studentCourseService.markContentAsViewed(contentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('👁️ Content viewed:', contentId);

          // Update local progress
          const contentBlock = this.content.find(c => c.id === contentId);
          if (contentBlock) {
            if (!contentBlock.progress) {
              contentBlock.progress = response.progress;
            } else {
              contentBlock.progress.viewed_at = response.progress.viewed_at;
            }
          }

          // Handle module auto-completion (rare case from viewing)
          if (response.module_auto_completed) {
            this.handleModuleAutoCompletion();
          }
        },
        error: (err) => {
          console.error('❌ Error viewing content:', err);
        }
      });
  }

  /**
   * Mark content as completed (only when moving forward)
   * This is the KEY method - called ONLY when user clicks Next or navigates away
   */
  private markContentAsCompleted(contentId: string, callback?: () => void): void {
    console.log('🔍 ========================================');
    console.log('🔍 markContentAsCompleted CALLED');
    console.log('🔍 ========================================');
    console.log('🔍 contentId:', contentId);
    console.log('🔍 isAlreadyCompleted:', this.isContentCompleted(contentId));
    console.log('🔍 isCurrentlyMarking:', this.isMarkingContent);

    this.logCompletionState('BEFORE MARK COMPLETE');

    // Skip if already completed or currently marking
    if (this.isContentCompleted(contentId) || this.isMarkingContent) {
      console.log('⏭️ SKIPPED - Already completed or marking in progress');
      console.log('🔍 ========================================');
      if (callback) callback();
      return;
    }

    this.isMarkingContent = true;
    console.log('🚀 Calling backend markContentAsCompleted for:', contentId);

    this.studentCourseService.markContentAsCompleted(contentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ ========================================');
          console.log('✅ Backend response received');
          console.log('✅ ========================================');
          console.log('✅ Response:', response);
          console.log('✅ Response progress:', response.progress);

          // Update local state
          this.completedContentIds.add(contentId);
          console.log('✅ Added to completedContentIds:', contentId);
          console.log('✅ Updated Set:', Array.from(this.completedContentIds));

          // Update content block progress
          const contentBlock = this.content.find(c => c.id === contentId);
          console.log('📦 Found content block:', contentBlock?.id);

          if (contentBlock) {
            if (!contentBlock.progress) {
              contentBlock.progress = response.progress;
            } else {
              contentBlock.progress.is_completed = true;
              contentBlock.progress.completed_at = response.progress.completed_at;
            }
            console.log('📦 Updated content block progress:', contentBlock.progress);
          }

          // Update parsed content
          const parsedBlock = this.parsedContent.find(p => p.id === contentId);
          if (parsedBlock) {
            parsedBlock.isCompleted = true;
            console.log('📝 Updated parsed block:', parsedBlock);
          }

          this.logCompletionState('AFTER MARK COMPLETE');

          // ✅ Check if quiz should be unlocked
          console.log('🔍 Checking if quiz should unlock...');
          this.checkQuizUnlock();

          // Handle module auto-completion
          if (response.module_auto_completed) {
            console.log('🎉 Module auto-completed!');
            this.handleModuleAutoCompletion();
          }

          this.isMarkingContent = false;

          // Execute callback (navigation)
          if (callback) {
            console.log('➡️ Executing callback (navigation)');
            callback();
          }

          console.log('✅ ========================================');
          console.log('✅ markContentAsCompleted COMPLETE');
          console.log('✅ ========================================');
        },
        error: (err) => {
          console.error('❌ ========================================');
          console.error('❌ Error completing content');
          console.error('❌ ========================================');
          console.error('❌ Error:', err);
          this.isMarkingContent = false;

          // Still execute callback even if completion fails
          if (callback) callback();
        }
      });
  }

  /**
   * ✅ FIX 2: Check if the quiz should be unlocked
   * Quiz unlocks when ALL content in the current module is completed
   */
  private checkQuizUnlock(): void {
    if (!this.quiz) {
      console.log('⏭️ No quiz for this module');
      return;
    }

    const totalContent = this.content.length;
    const completedContent = this.completedContentIds.size;

    console.log('🔍 ========================================');
    console.log('🔍 CHECKING QUIZ UNLOCK');
    console.log('🔍 ========================================');
    console.log('🔍 Total content:', totalContent);
    console.log('🔍 Completed content:', completedContent);
    console.log('🔍 All completed?', completedContent === totalContent);

    if (completedContent === totalContent && totalContent > 0) {
      console.log('🎉 ALL CONTENT COMPLETED - QUIZ UNLOCKED!');
      // Reload module content to refresh quiz state
      this.loadModuleContent();
    } else {
      console.log('🔒 Quiz still locked -', (totalContent - completedContent), 'content blocks remaining');
    }

    console.log('✅ ========================================');
  }

  /**
   * Handle module auto-completion
   * Shows celebration and navigates to next module or course
   */
  private handleModuleAutoCompletion(): void {
    console.log('🎉 Module auto-completed!');

    // Reload module content to get updated progress
    this.loadModuleContent();
  }

  /**
   * Check if content is completed
   */
  private isContentCompleted(contentId: string): boolean {
    return this.completedContentIds.has(contentId);
  }

  // ========== NAVIGATION METHODS ==========

  /**
   * Select content from sidebar
   * Does NOT auto-complete - user might be jumping around
   */
  selectContent(index: number): void {
    if (this.currentContentIndex === index) return;

    // Just switch content, track view only
    this.currentContentIndex = index;
    this.autoTrackContentView();
  }

  isContentActive(index: number): boolean {
    return this.currentContentIndex === index;
  }

  /**
   * Go to NEXT content or start quiz if last content
   * THIS is where we mark current content as completed!
   */
  goToNextContent(): void {
    if (!this.currentContent) return;

    if (this.currentContentIndex < this.totalContents - 1) {
      // Mark current as completed, THEN move to next
      this.markContentAsCompleted(this.currentContent.id, () => {
        this.currentContentIndex++;
        this.autoTrackContentView();
      });
    } else if (this.shouldShowStartQuiz) {
      // Last content with quiz - complete and start quiz immediately
      this.markContentAsCompleted(this.currentContent.id, () => {
        // Navigate to quiz after content is marked complete
        this.router.navigate(['/assessments/quiz/initiate'], {
          queryParams: {
            quizId: this.quiz!.id,
            moduleId: this.moduleId,
            courseId: this.courseId
          }
        });
      });
    } else {
      // Last content, no quiz - just mark complete
      this.markContentAsCompleted(this.currentContent.id);
    }
  }

  /**
   * Go to PREVIOUS content
   * Does NOT mark as completed - user is going backwards
   */
  goToPreviousContent(): void {
    if (this.currentContentIndex > 0) {
      // Just move back, don't mark as completed
      this.currentContentIndex--;
      this.autoTrackContentView();
    }
  }

  get canGoNext(): boolean {
    return this.currentContentIndex < this.totalContents - 1;
  }

  get canGoPrevious(): boolean {
    return this.currentContentIndex > 0;
  }

  get isLastContent(): boolean {
    return this.currentContentIndex === this.totalContents - 1;
  }

  /**
   * Take quiz
   * Mark current content as completed before navigating
   */
  takeQuiz(): void {
    if (!this.quiz || !this.currentContent) return;

    // Check if quiz can be taken
    if (!this.canTakeQuiz) {
      console.warn('Quiz is disabled:', this.quizDisabledReason);
      return;
    }

    // Mark current content as completed before leaving
    this.markContentAsCompleted(this.currentContent.id, () => {
      this.router.navigate(['/assessments/quiz/initiate'], {
        queryParams: {
          quizId: this.quiz!.id,
          moduleId: this.moduleId,
          courseId: this.courseId
        }
      });
    });
  }

  /**
   * Navigate to final exam
   */
  attemptFinalExam(): void {
    if (!this.finalExam || !this.canTakeFinalExam) {
      console.warn('Cannot take final exam');
      return;
    }

    this.router.navigate(['/assessments/quiz/initiate'], {
      queryParams: {
        quizId: this.finalExam.id,
        moduleId: 'final-exam',
        courseId: this.courseId,
        isFinalExam: 'true' // Pass as string
      }
    });
  }

  /**
   * Back to course
   * Mark current content as completed before leaving
   */
  backToCourse(): void {
    if (!this.currentContent) {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: this.courseId }
      });
      return;
    }

    // Mark current content as completed before leaving
    this.markContentAsCompleted(this.currentContent.id, () => {
      this.router.navigate(['/courses/details'], {
        queryParams: { id: this.courseId }
      });
    });
  }

  getEstimatedReadTime(content: ContentBlockWithProgress | null): string {
    if (!content) return '';
    const parsedBlock = this.parsedContent.find(p => p.id === content.id);
    if (!parsedBlock || !parsedBlock.html) return '';

    const text = parsedBlock.html.toString().replace(/<[^>]*>/g, '');
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const minutes = Math.ceil(wordCount / 200);
    return minutes <= 1 ? '1 min read' : `${minutes} min read`;
  }

  formatModuleNumber(): string {
    const order = this.module?.order || 0;
    return `Module ${order.toString().padStart(2, '0')}`;
  }

  getContentTitle(index: number): string {
    return `Content Block ${index + 1}`;
  }
}
