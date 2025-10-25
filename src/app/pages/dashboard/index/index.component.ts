// src/app/pages/dashboard/index/index.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../../libs/identity_access/services/user.service';

// Updated imports from course library
import { StudentCourseService } from '../../../libs/course/services/student-course.service';
import {
  GetStudentDashboardResponse,
  EnrollmentWithCourseAndProgressSummary
} from '../../../libs/course/models/learning-progress.dtos.interface';
import {
  GetAvailableCoursesResponse
} from '../../../libs/course/models/enrollment.dtos.interface';

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
  // Updated to use new dashboard response structure
  dashboardData: GetStudentDashboardResponse | null = null;
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

    console.log('🔄 Loading dashboard data...');

    // Use new getStudentDashboard method
    this.studentCourseService.getStudentDashboard().subscribe({
      next: (data: GetStudentDashboardResponse) => {
        console.log('✅ Dashboard data received:', data);
        console.log('📊 Dashboard Structure:');
        console.log('  - Total Courses:', data.total_courses);
        console.log('  - Total In Progress:', data.total_in_progress);
        console.log('  - Total Completed:', data.total_completed);
        console.log('  - Active Enrollments:', data.active_enrollments);
        console.log('  - In Progress Courses:', data.in_progress_courses);
        console.log('  - Completed Courses:', data.completed_courses);
        console.log('  - Continue Learning:', data.continue_learning);

        console.log('📈 Detailed Enrollment Data:');
        console.log('  Active Enrollments Count:', data.active_enrollments?.length || 0);
        console.log('  In Progress Count:', data.in_progress_courses?.length || 0);
        console.log('  Completed Count:', data.completed_courses?.length || 0);

        if (data.in_progress_courses && data.in_progress_courses.length > 0) {
          console.log('  First In Progress Course:', data.in_progress_courses[0]);
        }

        if (data.completed_courses && data.completed_courses.length > 0) {
          console.log('  First Completed Course:', data.completed_courses[0]);
        }

        this.dashboardData = data;

        console.log('🎯 Generating recent activities...');
        this.generateRecentActivities();
        console.log('  Recent Activities Generated:', this.recentActivities);

        this.isLoading = false;
        console.log('✅ Dashboard load complete');
      },
      error: (err) => {
        this.error = 'Failed to load dashboard data';
        this.isLoading = false;
        console.error('❌ Dashboard load error:', err);
        console.error('  Error details:', {
          message: err.message,
          status: err.status,
          statusText: err.statusText,
          error: err.error
        });
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
    if (!this.dashboardData) return;

    this.recentActivities = [];

    // Add completed courses as achievements
    this.dashboardData.completed_courses.slice(0, 2).forEach(enrollment => {
      this.recentActivities.push({
        type: 'quiz',
        icon: 'fas fa-trophy',
        title: `Completed: ${enrollment.course.title}`,
        subtitle: 'Certificate earned',
        time: this.getTimeAgo(enrollment.completed_at || enrollment.enrolled_at)
      });
    });

    // Add in-progress courses
    this.dashboardData.in_progress_courses.slice(0, 3).forEach(enrollment => {
      const progressPercent = enrollment.completion_percentage;
      this.recentActivities.push({
        type: 'module',
        icon: progressPercent > 0 ? 'fas fa-play-circle' : 'fas fa-book-open',
        title: progressPercent > 0 ? `Continuing: ${enrollment.course.title}` : `Started: ${enrollment.course.title}`,
        subtitle: `${progressPercent}% complete • ${enrollment.completed_modules}/${enrollment.total_modules} modules`,
        time: this.getTimeAgo(enrollment.last_accessed_at || enrollment.enrolled_at)
      });
    });

    // Sort by most recent and limit to 5
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

  // Updated getter methods using new dashboard structure
  getInProgressEnrollments(): EnrollmentWithCourseAndProgressSummary[] {
    return this.dashboardData?.in_progress_courses || [];
  }

  getCompletedEnrollments(): EnrollmentWithCourseAndProgressSummary[] {
    return this.dashboardData?.completed_courses || [];
  }

  getActiveEnrollments(): EnrollmentWithCourseAndProgressSummary[] {
    return this.dashboardData?.active_enrollments || [];
  }

  // Get active courses count (uses dashboard totals)
  getActiveCoursesCount(): number {
    return this.dashboardData?.total_in_progress || 0;
  }

  // Get completed courses count (uses dashboard totals)
  getCompletedCoursesCount(): number {
    return this.dashboardData?.total_completed || 0;
  }

  // Get total courses count
  getTotalCoursesCount(): number {
    return this.dashboardData?.total_courses || 0;
  }

  // Calculate average progress across all in-progress courses
  getAverageProgress(): number {
    const inProgress = this.getInProgressEnrollments();
    if (inProgress.length === 0) return 0;

    const total = inProgress.reduce(
      (sum, enrollment) => sum + (enrollment.completion_percentage || 0),
      0
    );

    return Math.round(total / inProgress.length);
  }

  // Get certificates earned (completed courses)
  getCertificatesEarned(): number {
    return this.getCompletedCoursesCount();
  }

  // Get continue learning item (from dashboard's continue_learning field)
  getContinueLearningItem(): EnrollmentWithCourseAndProgressSummary | null {
    // Dashboard provides the recommended course to continue
    if (this.dashboardData?.continue_learning) {
      return this.dashboardData.continue_learning;
    }

    // Fallback: get most recent in-progress course
    const inProgress = this.getInProgressEnrollments();
    if (inProgress.length === 0) return null;

    return inProgress[0]; // Already sorted by backend
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

  continueCourseLearning(enrollment: EnrollmentWithCourseAndProgressSummary): void {
    // Use next_module_id from the new structure
    if (enrollment.next_module_id) {
      this.navigateToModule(enrollment.course_id, enrollment.next_module_id);
    } else {
      // If no next module, go to course progress page
      this.navigateToCourseProgress(enrollment.course_id);
    }
  }

  viewCourseDetails(courseId: string): void {
    this.navigateToCourseDetails(courseId);
  }

  // Helper methods for template
  isCompleted(enrollment: EnrollmentWithCourseAndProgressSummary): boolean {
    return enrollment.status === 'completed' || !!enrollment.completed_at;
  }

  getProgressPercentage(enrollment: EnrollmentWithCourseAndProgressSummary): number {
    return enrollment.completion_percentage || 0;
  }

  getCompletedModules(enrollment: EnrollmentWithCourseAndProgressSummary): number {
    return enrollment.completed_modules || 0;
  }

  getTotalModules(enrollment: EnrollmentWithCourseAndProgressSummary): number {
    return enrollment.total_modules || 0;
  }
}
