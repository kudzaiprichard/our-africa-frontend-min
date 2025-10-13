// src/app/pages/dashboard/index/index.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  GetAvailableCoursesResponse,
  GetStudentEnrollmentsResponse,
  EnrollmentWithCourseAndProgress,
  StudentCourseService
} from '../../../libs/course';
import { UserService } from '../../../libs/identity_access/services/user.service';

interface ActivityItem {
  type: 'quiz' | 'module' | 'enrollment';
  icon: string;
  title: string;
  subtitle: string;
  time: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit {
  enrollments: EnrollmentWithCourseAndProgress[] = [];
  availableCourses: GetAvailableCoursesResponse | null = null;
  recentActivities: ActivityItem[] = [];
  isLoading = false;
  error: string | null = null;

  constructor(
    private studentCourseService: StudentCourseService,
    public userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadAvailableCourses();
  }

  loadDashboard(): void {
    this.isLoading = true;
    this.error = null;

    this.studentCourseService.getMyEnrollments().subscribe({
      next: (data: GetStudentEnrollmentsResponse) => {
        console.log('Enrollments data:', data); // Debug log
        this.enrollments = data.enrollments || [];
        this.generateRecentActivities();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load dashboard data';
        this.isLoading = false;
        console.error('Dashboard load error:', err);
      }
    });
  }

  loadAvailableCourses(): void {
    this.studentCourseService.getAvailableCourses(1, 6).subscribe({
      next: (data) => {
        this.availableCourses = data;
      },
      error: (err) => {
        console.error('Failed to load available courses:', err);
      }
    });
  }

  generateRecentActivities(): void {
    this.recentActivities = [];

    // Add completed courses as achievements
    this.getCompletedEnrollments().slice(0, 2).forEach(enrollment => {
      this.recentActivities.push({
        type: 'quiz',
        icon: 'fas fa-trophy',
        title: `Completed: ${enrollment.course.title}`,
        subtitle: 'Certificate earned',
        time: this.getTimeAgo(enrollment.completed_at || enrollment.enrolled_at)
      });
    });

    // Add in-progress courses
    this.getInProgressEnrollments().slice(0, 3).forEach(enrollment => {
      const progressPercent = enrollment.progress.completion_percentage;
      this.recentActivities.push({
        type: 'module',
        icon: progressPercent > 0 ? 'fas fa-play-circle' : 'fas fa-book-open',
        title: progressPercent > 0 ? `Continuing: ${enrollment.course.title}` : `Started: ${enrollment.course.title}`,
        subtitle: `${progressPercent}% complete • ${enrollment.progress.completed_modules}/${enrollment.progress.total_modules} modules`,
        time: this.getTimeAgo(enrollment.enrolled_at)
      });
    });

    // Sort by most recent (simplified - use enrolled_at for sorting)
    this.recentActivities = this.recentActivities.slice(0, 5);
  }

  getTimeAgo(dateString: string | undefined): string {
    if (!dateString) return 'Recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Get all in-progress enrollments
  getInProgressEnrollments(): EnrollmentWithCourseAndProgress[] {
    return this.enrollments.filter(enrollment =>
      enrollment.status === 'active' && !enrollment.completed_at
    );
  }

  // Get all completed enrollments
  getCompletedEnrollments(): EnrollmentWithCourseAndProgress[] {
    return this.enrollments.filter(enrollment =>
      enrollment.status === 'completed' || !!enrollment.completed_at
    );
  }

  // Get active courses (in progress)
  getActiveCoursesCount(): number {
    return this.getInProgressEnrollments().length;
  }

  // Get completed courses count
  getCompletedCoursesCount(): number {
    return this.getCompletedEnrollments().length;
  }

  // Calculate average progress across all active courses
  getAverageProgress(): number {
    const inProgress = this.getInProgressEnrollments();
    if (inProgress.length === 0) return 0;

    const total = inProgress.reduce(
      (sum, enrollment) => sum + (enrollment.progress.completion_percentage || 0),
      0
    );

    return Math.round(total / inProgress.length);
  }

  // Get certificates earned (completed courses)
  getCertificatesEarned(): number {
    return this.getCompletedEnrollments().length;
  }

  // Get continue learning item (most recent in-progress course)
  getContinueLearningItem(): EnrollmentWithCourseAndProgress | null {
    const inProgress = this.getInProgressEnrollments();
    if (inProgress.length === 0) return null;

    // Return the course with most recent activity or highest progress
    return inProgress.sort((a, b) =>
      (b.progress.completion_percentage || 0) - (a.progress.completion_percentage || 0)
    )[0];
  }

  // Navigation Methods
  navigateToCatalog(): void {
    this.router.navigate(['/courses/catalogs']);
  }

  navigateToEnrollments(): void {
    this.router.navigate(['/courses/enrollments']);
  }

  navigateToCourseDetails(courseId: string): void {
    this.router.navigate(['/courses/details'], { queryParams: { id: courseId } });
  }

  navigateToCourseProgress(courseId: string): void {
    this.router.navigate(['/courses/details'], { queryParams: { id: courseId } });
  }

  navigateToModule(courseId: string, moduleId: string): void {
    this.router.navigate(['/courses/module/content'], {
      queryParams: { courseId, moduleId }
    });
  }

  // Enrollment Actions
  enrollInCourse(courseId: string): void {
    this.studentCourseService.enrollInCourse(courseId).subscribe({
      next: (response) => {
        console.log('Enrolled successfully:', response);
        // Reload dashboard to reflect new enrollment
        this.loadDashboard();
        this.loadAvailableCourses();
      },
      error: (err) => {
        console.error('Enrollment failed:', err);
        alert('Failed to enroll in course. Please try again.');
      }
    });
  }

  continueCourseLearning(enrollment: EnrollmentWithCourseAndProgress): void {
    if (enrollment.next_module?.id) {
      this.navigateToModule(enrollment.course_id, enrollment.next_module.id);
    } else {
      // If no next module, go to course progress page
      this.navigateToCourseProgress(enrollment.course_id);
    }
  }

  viewCourseDetails(courseId: string): void {
    this.navigateToCourseDetails(courseId);
  }

  // Helper methods for template
  isCompleted(enrollment: EnrollmentWithCourseAndProgress): boolean {
    return enrollment.status === 'completed' || !!enrollment.completed_at;
  }

  getProgressPercentage(enrollment: EnrollmentWithCourseAndProgress): number {
    return enrollment.progress.completion_percentage || 0;
  }

  getCompletedModules(enrollment: EnrollmentWithCourseAndProgress): number {
    return enrollment.progress.completed_modules || 0;
  }

  getTotalModules(enrollment: EnrollmentWithCourseAndProgress): number {
    return enrollment.progress.total_modules || 0;
  }
}
