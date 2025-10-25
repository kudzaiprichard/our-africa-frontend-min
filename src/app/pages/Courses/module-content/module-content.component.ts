import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
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

  isLoading = false;
  error: string | null = null;

  parsedContent: ParsedContentBlock[] = [];

  // Track if we're currently marking content (prevent duplicate calls)
  private isMarkingContent = false;
  // Track last viewed content to prevent duplicate view calls
  private lastViewedContentId: string | null = null;

  // ✅ NEW: Cooldown timer properties
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

    // ✅ Clear cooldown timer
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  loadModuleContent(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getModuleContent(this.moduleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetModuleContentForStudentResponse) => {
          this.module = response.module;
          this.content = response.content;
          this.quiz = response.quiz || null;

          // Initialize completed content IDs from progress data
          this.content.forEach(block => {
            if (block.progress?.is_completed) {
              this.completedContentIds.add(block.id);
            }
          });

          // If resume_content_id is provided, jump to that content
          if (response.resume_content_id) {
            const resumeIndex = this.content.findIndex(c => c.id === response.resume_content_id);
            if (resumeIndex !== -1) {
              this.currentContentIndex = resumeIndex;
            }
          }

          this.parseContent();

          // Mark module as started if not already
          this.markModuleAsStarted();

          // Only track VIEW, not completion
          this.autoTrackContentView();

          // ✅ NEW: Start cooldown timer if quiz has cooldown
          this.startCooldownTimer();

          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load module content';
          this.isLoading = false;
          console.error('Error loading module content:', err);
        }
      });
  }

  // ✅ NEW: Start cooldown countdown timer
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

  // ✅ NEW: Update cooldown display
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
          { href: src, target: '_blank', class: 'document-card' },
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

  /**
   * ✅ UPDATED: Check if student can take the quiz
   * Unlocks quiz if on last content block OR all content completed
   */
  get canTakeQuiz(): boolean {
    if (!this.quiz) return false;

    // ✅ NEW: If on last content block, allow quiz (they're about to complete it)
    if (this.isLastContent) {
      return this.quiz.student_can_attempt;
    }

    // Otherwise, require all content blocks to be completed
    const allContentCompleted = this.completedContents === this.totalContents;
    const hasAttemptsRemaining = this.quiz.student_can_attempt;

    return allContentCompleted && hasAttemptsRemaining;
  }

  /**
   * ✅ UPDATED: Get quiz disabled reason with cooldown timer
   */
  get quizDisabledReason(): string | null {
    if (!this.quiz) return null;

    // If on last content, only check attempts
    if (this.isLastContent) {
      if (!this.quiz.student_can_attempt) {
        if (this.cooldownTimeRemaining) {
          return `Available in ${this.cooldownTimeRemaining}`;
        }
        return 'No attempts remaining';
      }
      return null; // Quiz is available
    }

    // If not on last content, check completion status
    const allContentCompleted = this.completedContents === this.totalContents;

    if (!allContentCompleted) {
      const remaining = this.totalContents - this.completedContents;
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
    return !!(this.isLastContent && this.module?.has_quiz && this.quiz);
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
    // Skip if already completed or currently marking
    if (this.isContentCompleted(contentId) || this.isMarkingContent) {
      if (callback) callback();
      return;
    }

    this.isMarkingContent = true;

    this.studentCourseService.markContentAsCompleted(contentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Content completed:', contentId);

          // Update local state
          this.completedContentIds.add(contentId);

          // Update content block progress
          const contentBlock = this.content.find(c => c.id === contentId);
          if (contentBlock) {
            if (!contentBlock.progress) {
              contentBlock.progress = response.progress;
            } else {
              contentBlock.progress.is_completed = true;
              contentBlock.progress.completed_at = response.progress.completed_at;
            }
          }

          // Update parsed content
          const parsedBlock = this.parsedContent.find(p => p.id === contentId);
          if (parsedBlock) {
            parsedBlock.isCompleted = true;
          }

          // Handle module auto-completion
          if (response.module_auto_completed) {
            this.handleModuleAutoCompletion();
          }

          this.isMarkingContent = false;

          // Execute callback (navigation)
          if (callback) callback();
        },
        error: (err) => {
          console.error('❌ Error completing content:', err);
          this.isMarkingContent = false;

          // Still execute callback even if completion fails
          if (callback) callback();
        }
      });
  }

  /**
   * Handle module auto-completion
   * Shows celebration and navigates to next module or course
   */
  private handleModuleAutoCompletion(): void {
    console.log('🎉 Module auto-completed!');

    // Reload module content to get updated progress
    this.studentCourseService.getModuleContent(this.moduleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.module = response.module;
          console.log('✅ Module progress updated after auto-completion');
        },
        error: (err) => {
          console.error('❌ Error refreshing module after auto-completion:', err);
        }
      });
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
