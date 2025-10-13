import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import {
  GetModuleContentForStudentResponse,
  StudentCourseService,
  ModuleWithProgress,
  ContentBlockForStudent,
  QuizForStudent
} from '../../../libs/course';

interface ParsedContentBlock {
  id: string;
  title?: string;
  order: number;
  html?: SafeHtml;
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
  content: ContentBlockForStudent[] = [];
  quiz: QuizForStudent | null = null;
  currentContentIndex: number = 0;
  completedContentIds = new Set<string>();

  isLoading = false;
  error: string | null = null;

  parsedContent: ParsedContentBlock[] = [];

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
          this.parseContent();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load module content';
          this.isLoading = false;
          console.error('Error loading module content:', err);
        }
      });
  }

  parseContent(): void {
    this.parsedContent = this.content.map(block => ({
      id: block.id,
      title: block.title,
      order: block.order,
      html: this.convertDeltaToHtml(block.content_data)
    }));
  }

  convertDeltaToHtml(delta: any): SafeHtml {
    if (!delta || !delta.ops || !Array.isArray(delta.ops)) {
      return '';
    }

    const converter = new QuillDeltaToHtmlConverter(delta.ops, {
      encodeHtml: true
    });

    const html = converter.convert();

    // Enhance the HTML with additional styling
    const enhancedHtml = this.enhanceContentHtml(html);

    return this.sanitizer.bypassSecurityTrustHtml(enhancedHtml);
  }

  private enhanceContentHtml(html: string): string {
    // Enhance code blocks with better styling
    let enhanced = html.replace(
      /<pre class="ql-syntax">([\s\S]*?)<\/pre>/g,
      '<div class="code-block-enhanced"><div class="code-header"><div class="code-language"><i class="fas fa-code"></i><span>Code</span></div><div class="code-dots"><div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div></div></div><pre class="code-content">$1</pre></div>'
    );

    // Ensure images have proper styling
    enhanced = enhanced.replace(
      /<img([^>]*)>/g,
      '<img$1 style="max-width: 100%; height: auto; border-radius: 12px; margin: 32px 0;">'
    );

    // Add caption support for images that are followed by text
    enhanced = enhanced.replace(
      /<img([^>]*)>\s*<br>\s*<em>([^<]*)<\/em>/g,
      '<div class="image-with-caption"><img$1><div class="image-caption">$2</div></div>'
    );

    return enhanced;
  }

  get currentParsedContent(): ParsedContentBlock | null {
    return this.parsedContent[this.currentContentIndex] || null;
  }

  get currentContent() {
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

  selectContent(index: number): void {
    this.currentContentIndex = index;
  }

  isContentActive(index: number): boolean {
    return this.currentContentIndex === index;
  }

  markContentAsCompleted(): void {
    if (!this.currentContent) return;
    this.completedContentIds.add(this.currentContent.id);
  }

  goToNextContent(): void {
    if (this.currentContentIndex < this.totalContents - 1) {
      this.markContentAsCompleted();
      this.currentContentIndex++;
    } else if (this.module?.has_quiz) {
      this.markContentAsCompleted();
    } else {
      this.markContentAsCompleted();
    }
  }

  goToPreviousContent(): void {
    if (this.currentContentIndex > 0) {
      this.currentContentIndex--;
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

  takeQuiz(): void {
    if (!this.quiz) return;
    this.router.navigate(['/assessments/quiz/initiate'], {
      queryParams: {
        quizId: this.quiz.id,
        moduleId: this.moduleId,
        courseId: this.courseId
      }
    });
  }

  backToCourse(): void {
    this.router.navigate(['/courses/details'], {
      queryParams: { id: this.courseId }
    });
  }

  getEstimatedReadTime(content: any): string {
    if (!content) return '';
    const parsedBlock = this.parsedContent.find(p => p.id === content.id);
    if (!parsedBlock || !parsedBlock.html) return '';

    const text = parsedBlock.html.toString().replace(/<[^>]*>/g, ''); // strip HTML tags
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    return minutes <= 1 ? '1 min read' : `${minutes} min read`;
  }

  formatModuleNumber(): string {
    const order = this.module?.order || 0;
    return `Module ${order.toString().padStart(2, '0')}`;
  }
}
