// src/app/pages/certificates/certificates-list/certificates-list.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { CertificateService } from '../../../libs/certificate';
import {
  GetMyCertificatesResponse,
  IssuedCertificateBasic
} from '../../../libs/certificate';

interface CertificatePair {
  certificate: IssuedCertificateBasic;
  transcript: IssuedCertificateBasic;
  courseId: string;
  courseName: string;
  issueDate: Date;
}

@Component({
  selector: 'app-certificates-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './certificates-list.component.html',
  styleUrl: './certificates-list.component.scss'
})
export class CertificatesListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  allCertificatePairs: CertificatePair[] = [];
  filteredPairs: CertificatePair[] = [];
  displayedPairs: CertificatePair[] = [];

  // Stats
  totalCertificates = 0;
  totalTranscripts = 0;
  totalCourses = 0;
  recentAchievements = 0;

  // Pagination
  currentPage = 1;
  perPage = 9;
  totalPages = 0;

  // Loading & Error
  isLoading = false;
  error: string | null = null;

  // Search & Filters
  searchQuery = '';
  selectedType = 'All';
  selectedDateRange = 'All Time';
  sortBy = 'Recent First';

  // Filter Options
  typeOptions = ['All', 'Certificate', 'Transcript'];
  dateRangeOptions = ['All Time', 'Last 30 Days', 'Last 90 Days', 'This Year'];
  sortOptions = ['Recent First', 'Oldest First', 'Course Name: A-Z', 'Course Name: Z-A'];

  constructor(
    private certificateService: CertificateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCertificates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCertificates(): void {
    this.isLoading = true;
    this.error = null;

    this.certificateService
      .getMyCertificates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetMyCertificatesResponse) => {
          this.processCertificates(response.certificates);
          this.calculateStats(response.certificates);
          this.applyFilters();
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load certificates. Please try again.';
          this.isLoading = false;
          console.error('Error loading certificates:', err);
        }
      });
  }

  processCertificates(certificates: IssuedCertificateBasic[]): void {
    // Group certificates by course_id
    const courseMap = new Map<string, { cert?: IssuedCertificateBasic; trans?: IssuedCertificateBasic }>();

    certificates.forEach(cert => {
      if (!courseMap.has(cert.course_id)) {
        courseMap.set(cert.course_id, {});
      }
      const group = courseMap.get(cert.course_id)!;

      if (cert.certificate_type === 'CERTIFICATE') {
        group.cert = cert;
      } else {
        group.trans = cert;
      }
    });

    // Create pairs
    this.allCertificatePairs = Array.from(courseMap.entries())
      .filter(([_, group]) => group.cert && group.trans)
      .map(([courseId, group]) => ({
        certificate: group.cert!,
        transcript: group.trans!,
        courseId: courseId,
        courseName: this.extractCourseName(group.cert!),
        issueDate: new Date(group.cert!.issued_date)
      }));
  }

  extractCourseName(certificate: IssuedCertificateBasic): string {
    // Extract from certificate number or use course_id as fallback
    // Format: CERT-2024-001 -> "Course 001"
    const parts = certificate.certificate_number.split('-');
    return `Course ${parts[parts.length - 1]}`;
  }

  calculateStats(certificates: IssuedCertificateBasic[]): void {
    this.totalCertificates = certificates.filter(c => c.certificate_type === 'CERTIFICATE').length;
    this.totalTranscripts = certificates.filter(c => c.certificate_type === 'TRANSCRIPT').length;
    this.totalCourses = this.allCertificatePairs.length;

    // Recent achievements (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    this.recentAchievements = certificates.filter(
      c => new Date(c.issued_date) > thirtyDaysAgo
    ).length;
  }

  applyFilters(): void {
    let filtered = [...this.allCertificatePairs];

    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(pair =>
        pair.courseName.toLowerCase().includes(query) ||
        pair.certificate.certificate_number.toLowerCase().includes(query) ||
        pair.transcript.certificate_number.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (this.selectedDateRange !== 'All Time') {
      const now = new Date();
      let cutoffDate = new Date();

      switch (this.selectedDateRange) {
        case 'Last 30 Days':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case 'Last 90 Days':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case 'This Year':
          cutoffDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      filtered = filtered.filter(pair => pair.issueDate >= cutoffDate);
    }

    // Sort
    this.sortPairs(filtered);

    this.filteredPairs = filtered;
    this.totalPages = Math.ceil(this.filteredPairs.length / this.perPage);
    this.currentPage = 1;
    this.updateDisplayedPairs();
  }

  sortPairs(pairs: CertificatePair[]): void {
    switch (this.sortBy) {
      case 'Recent First':
        pairs.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
        break;
      case 'Oldest First':
        pairs.sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());
        break;
      case 'Course Name: A-Z':
        pairs.sort((a, b) => a.courseName.localeCompare(b.courseName));
        break;
      case 'Course Name: Z-A':
        pairs.sort((a, b) => b.courseName.localeCompare(a.courseName));
        break;
    }
  }

  updateDisplayedPairs(): void {
    const startIndex = (this.currentPage - 1) * this.perPage;
    const endIndex = startIndex + this.perPage;
    this.displayedPairs = this.filteredPairs.slice(startIndex, endIndex);
  }

  onSearch(): void {
    this.applyFilters();
  }

  selectType(type: string): void {
    this.selectedType = type;
    // For simplicity, we're showing pairs, so type filter is informational
  }

  selectDateRange(range: string): void {
    this.selectedDateRange = range;
    this.applyFilters();
  }

  onSortChange(): void {
    this.applyFilters();
  }

  viewCertificateDetail(certificateId: string): void {
    this.router.navigate(['/certificates', certificateId]);
  }

  downloadCertificate(certificateId: string, certificateNumber: string, event: Event): void {
    event.stopPropagation();
    this.certificateService.downloadCertificateWithFilename(certificateId, certificateNumber);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getCertificateGradient(index: number): string {
    const gradients = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #14b8a6, #0891b2)',
    ];
    return gradients[index % gradients.length];
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedPairs();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateDisplayedPairs();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplayedPairs();
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
}
