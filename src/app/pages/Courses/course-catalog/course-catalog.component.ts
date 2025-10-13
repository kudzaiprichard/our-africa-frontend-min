// src/app/pages/courses/course-catalog/course-catalog.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GetAvailableCoursesResponse, StudentCourseService, CourseBasicForEnrollment } from '../../../libs/course';

@Component({
  selector: 'app-course-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-catalog.component.html',
  styleUrl: './course-catalog.component.scss'
})
export class CourseCatalogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  allCourses: CourseBasicForEnrollment[] = [];
  filteredCourses: CourseBasicForEnrollment[] = [];
  displayedCourses: CourseBasicForEnrollment[] = [];

  // Pagination
  currentPage = 1;
  perPage = 12;
  totalCourses = 0;
  totalPages = 0;

  // Loading & Error
  isLoading = false;
  error: string | null = null;

  // Search & Filters
  searchQuery = '';
  selectedCategory = 'All Courses';
  selectedLevel: string[] = [];
  selectedDuration: string[] = [];
  selectedFeatures: string[] = [];
  selectedRating: string[] = [];
  sortBy = 'Most Popular';

  // Categories
  categories = [
    'All Courses',
    'Programming',
    'Design',
    'Data Science',
    'Business',
    'Marketing',
    'Personal Development'
  ];

  // Filter Options
  levelOptions = ['Beginner', 'Intermediate', 'Advanced'];
  durationOptions = ['0-10 hours', '10-30 hours', '30+ hours'];
  featureOptions = ['Quizzes', 'Certificate', 'Final Exam'];
  ratingOptions = ['4.5 & up', '4.0 & up', '3.5 & up'];
  sortOptions = ['Most Popular', 'Highest Rated', 'Newest First', 'Title: A-Z'];

  // Pre-calculated values
  private badgeMap = new Map<string, string | null>();
  private categoryMap = new Map<string, string>();
  private ratingMap = new Map<string, number>();

  constructor(
    private studentCourseService: StudentCourseService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCourses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCourses(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService
      .getAvailableCourses(1, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetAvailableCoursesResponse) => {
          this.allCourses = response.courses;
          this.totalCourses = response.total;

          // Pre-calculate random values
          this.allCourses.forEach((course) => {
            // Badge
            const badges = ['Bestseller', 'New', 'Popular', 'Trending'];
            const randomIndex = Math.floor(Math.random() * (badges.length + 2));
            this.badgeMap.set(course.id, randomIndex < badges.length ? badges[randomIndex] : null);

            // Category - use actual categories or random
            if (course.categories_display && course.categories_display.length > 0) {
              this.categoryMap.set(course.id, course.categories_display[0]);
            } else {
              const categoryIndex = Math.floor(Math.random() * (this.categories.length - 1)) + 1;
              this.categoryMap.set(course.id, this.categories[categoryIndex]);
            }

            // Rating
            const rating = parseFloat((4.5 + Math.random() * 0.4).toFixed(1));
            this.ratingMap.set(course.id, rating);
          });

          this.applyFilters();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load courses. Please try again.';
          this.isLoading = false;
          console.error('Error loading courses:', err);
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.allCourses];

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (this.selectedCategory !== 'All Courses') {
      filtered = filtered.filter(course =>
        this.categoryMap.get(course.id) === this.selectedCategory
      );
    }

    // Level filter
    if (this.selectedLevel.length > 0) {
      filtered = filtered.filter(course =>
        this.selectedLevel.includes(course.level.charAt(0).toUpperCase() + course.level.slice(1))
      );
    }

    // Duration filter
    if (this.selectedDuration.length > 0) {
      filtered = filtered.filter(course => {
        const duration = course.duration;
        return this.selectedDuration.some(range => {
          if (range === '0-10 hours') return duration <= 10;
          if (range === '10-30 hours') return duration > 10 && duration <= 30;
          if (range === '30+ hours') return duration > 30;
          return false;
        });
      });
    }

    // Sort
    this.sortCourses(filtered);

    this.filteredCourses = filtered;
    this.totalCourses = filtered.length;
    this.totalPages = Math.ceil(this.totalCourses / this.perPage);
    this.currentPage = 1;
    this.updateDisplayedCourses();
  }

  sortCourses(courses: CourseBasicForEnrollment[]): void {
    switch (this.sortBy) {
      case 'Highest Rated':
        courses.sort((a, b) => (this.ratingMap.get(b.id) || 0) - (this.ratingMap.get(a.id) || 0));
        break;
      case 'Newest First':
        // Sort by title as fallback since created_at is not available
        courses.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'Title: A-Z':
        courses.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'Most Popular':
      default:
        courses.sort((a, b) => b.module_count - a.module_count);
        break;
    }
  }

  updateDisplayedCourses(): void {
    const startIndex = (this.currentPage - 1) * this.perPage;
    const endIndex = startIndex + this.perPage;
    this.displayedCourses = this.filteredCourses.slice(startIndex, endIndex);
  }

  onSearch(): void {
    this.applyFilters();
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  toggleLevelFilter(level: string): void {
    const index = this.selectedLevel.indexOf(level);
    if (index > -1) {
      this.selectedLevel.splice(index, 1);
    } else {
      this.selectedLevel.push(level);
    }
    this.applyFilters();
  }

  toggleDurationFilter(duration: string): void {
    const index = this.selectedDuration.indexOf(duration);
    if (index > -1) {
      this.selectedDuration.splice(index, 1);
    } else {
      this.selectedDuration.push(duration);
    }
    this.applyFilters();
  }

  toggleFeatureFilter(feature: string): void {
    const index = this.selectedFeatures.indexOf(feature);
    if (index > -1) {
      this.selectedFeatures.splice(index, 1);
    } else {
      this.selectedFeatures.push(feature);
    }
    this.applyFilters();
  }

  toggleRatingFilter(rating: string): void {
    const index = this.selectedRating.indexOf(rating);
    if (index > -1) {
      this.selectedRating.splice(index, 1);
    } else {
      this.selectedRating.push(rating);
    }
    this.applyFilters();
  }

  isLevelChecked(level: string): boolean {
    return this.selectedLevel.includes(level);
  }

  isDurationChecked(duration: string): boolean {
    return this.selectedDuration.includes(duration);
  }

  isFeatureChecked(feature: string): boolean {
    return this.selectedFeatures.includes(feature);
  }

  isRatingChecked(rating: string): boolean {
    return this.selectedRating.includes(rating);
  }

  onSortChange(): void {
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedCourses();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateDisplayedCourses();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplayedCourses();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, startPage + maxPages - 1);

    if (endPage - startPage < maxPages - 1) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  getCourseGradient(index: number): string {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #14b8a6, #0891b2)',
      'linear-gradient(135deg, #f97316, #dc2626)',
      'linear-gradient(135deg, #a855f7, #6366f1)',
      'linear-gradient(135deg, #84cc16, #22c55e)'
    ];
    return gradients[index % gradients.length];
  }

  getCourseIcon(index: number): string {
    const icons = [
      'fa-code',
      'fa-brain',
      'fa-paint-brush',
      'fa-globe',
      'fa-mobile-alt',
      'fa-shield-alt',
      'fa-chart-line',
      'fa-database',
      'fa-robot'
    ];
    return icons[index % icons.length];
  }

  getCourseBadge(course: CourseBasicForEnrollment): string | null {
    return this.badgeMap.get(course.id) || null;
  }

  getCourseCategory(course: CourseBasicForEnrollment): string {
    return this.categoryMap.get(course.id) || 'Programming';
  }

  getEstimatedDuration(duration: number): string {
    return `${duration}h`;
  }

  getCourseRating(course: CourseBasicForEnrollment): number {
    return this.ratingMap.get(course.id) || 4.5;
  }

  viewCourseDetails(courseId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/courses/details'], {
      queryParams: { id: courseId }
    });
  }

  enrollInCourse(courseId: string, event: Event): void {
    event.stopPropagation();
    this.studentCourseService.enrollInCourse(courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Enrolled successfully:', response);
          this.loadCourses();
        },
        error: (err) => {
          console.error('Enrollment failed:', err);
          alert('Failed to enroll. Please try again.');
        }
      });
  }
}
