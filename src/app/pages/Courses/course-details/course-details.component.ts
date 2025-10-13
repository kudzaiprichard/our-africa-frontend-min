// src/app/pages/courses/course-details/course-details.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import {
  CheckEnrollmentEligibilityResponse,
  GetCourseModulesResponse,
  GetCourseResponse,
  StudentCourseService,
  CourseFull,
  ModuleBasic,
  QuizBasic
} from '../../../libs/course';

@Component({
  selector: 'app-course-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.scss'
})
export class CourseDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  courseId: string = '';
  course: CourseFull | null = null;
  finalExam: QuizBasic | null = null;
  modules: ModuleBasic[] = [];
  eligibility: CheckEnrollmentEligibilityResponse | null = null;

  isLoading = false;
  error: string | null = null;

  expandedModules = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private studentCourseService: StudentCourseService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.courseId = params['id'];
        if (this.courseId) {
          this.loadAllData();
        } else {
          this.error = 'No course ID provided';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllData(): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      courseDetails: this.studentCourseService.getCourseDetails(this.courseId),
      modules: this.studentCourseService.getCourseModules(this.courseId),
      eligibility: this.studentCourseService.checkEnrollmentEligibility(this.courseId)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (responses) => {
          this.course = responses.courseDetails.course;
          this.finalExam = responses.courseDetails.final_exam || null;
          this.modules = responses.modules.modules;
          this.eligibility = responses.eligibility;
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load course details';
          this.isLoading = false;
          console.error('Error loading course:', err);
        }
      });
  }

  toggleModule(moduleId: string): void {
    if (this.expandedModules.has(moduleId)) {
      this.expandedModules.delete(moduleId);
    } else {
      this.expandedModules.add(moduleId);
    }
  }

  isModuleExpanded(moduleId: string): boolean {
    return this.expandedModules.has(moduleId);
  }

  enrollInCourse(): void {
    if (!this.canEnroll()) {
      return;
    }

    this.studentCourseService.enrollInCourse(this.courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Enrolled successfully:', response);
          this.router.navigate(['/courses/enrollments']);
        },
        error: (err) => {
          console.error('Enrollment failed:', err);
          this.error = 'Failed to enroll in course';
          alert('Failed to enroll. Please try again.');
        }
      });
  }

  viewModuleContent(moduleId: string): void {
    this.router.navigate(['/courses/module/content'], {
      queryParams: { moduleId: moduleId, courseId: this.courseId }
    });
  }

  shareCourse(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: this.course?.title || 'Course',
        text: this.course?.description || 'Check out this course!',
        url: url
      }).catch(err => console.log('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('Course link copied to clipboard!');
      });
    }
  }

  canEnroll(): boolean {
    return this.eligibility?.eligible === true;
  }

  isEnrolled(): boolean {
    return false;
  }

  getEstimatedDuration(moduleCount: number): string {
    const hours = moduleCount * 3;
    return `${hours} Hours`;
  }

  getCourseCategory(): string {
    if (this.course?.categories_display && this.course.categories_display.length > 0) {
      return this.course.categories_display[0];
    }
    return 'Programming';
  }

  getCourseRating(): string {
    return '4.8/5.0';
  }

  getEnrolledStudents(): string {
    return this.course?.enrollment_count?.toLocaleString() || '0';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  }

  getModuleDuration(contentCount: number): string {
    const hours = contentCount * 0.5;
    return `${hours.toFixed(1)} hours`;
  }

  goBack(): void {
    this.router.navigate(['/courses/catalogs']);
  }
}
