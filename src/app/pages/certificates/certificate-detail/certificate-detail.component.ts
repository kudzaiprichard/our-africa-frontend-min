// src/app/pages/certificates/certificate-detail/certificate-detail.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { CertificateService } from '../../../libs/certificate';
import {
  GetCertificateDetailsResponse,
  IssuedCertificateFull
} from '../../../libs/certificate';

@Component({
  selector: 'app-certificate-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './certificate-detail.component.html',
  styleUrl: './certificate-detail.component.scss'
})
export class CertificateDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Certificate Data
  certificate: IssuedCertificateFull | null = null;
  transcript: IssuedCertificateFull | null = null;
  certificateId: string = '';

  // UI State
  isLoading = false;
  error: string | null = null;
  activeTab: 'certificate' | 'transcript' = 'certificate';
  showQRCode = false;

  // Parsed Certificate Data
  studentName = '';
  courseTitle = '';
  issueDate = '';
  completionDate = '';
  grade = '';
  totalScore = '';
  modules: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private certificateService: CertificateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.certificateId = params.get('certificateId') || '';
        if (this.certificateId) {
          this.loadCertificateDetails();
        } else {
          this.error = 'Invalid certificate ID';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCertificateDetails(): void {
    this.isLoading = true;
    this.error = null;

    this.certificateService
      .getCertificateDetails(this.certificateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetCertificateDetailsResponse) => {
          this.certificate = response.certificate;

          // Load transcript for the same course
          this.loadTranscript(this.certificate.course_id);

          // Parse certificate data
          this.parseCertificateData();

          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Failed to load certificate details. Please try again.';
          this.isLoading = false;
          console.error('Error loading certificate:', err);
        }
      });
  }

  loadTranscript(courseId: string): void {
    this.certificateService
      .getCertificateByCourse(courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Find the transcript from the course
          // Since getCertificateByCourse returns one certificate, we need to get both
          // For now, we'll handle this by checking certificate_type
          if (response.certificate.certificate_type === 'TRANSCRIPT') {
            this.transcript = response.certificate;
          }
        },
        error: (err) => {
          console.log('Transcript not found or error loading:', err);
          // It's okay if transcript is not found
        }
      });
  }

  parseCertificateData(): void {
    if (!this.certificate) return;

    // Extract data from certificate.data object
    const data = this.certificate.data || {};

    this.studentName = this.certificate.student_name || data['student_name'] || 'Student';
    this.courseTitle = this.certificate.course_title || data['course_title'] || 'Course';
    this.issueDate = this.formatDate(this.certificate.issued_date);
    this.completionDate = data['completion_date'] ? this.formatDate(data['completion_date']) : this.issueDate;
    this.grade = data['grade'] || data['final_grade'] || 'N/A';
    this.totalScore = data['total_score'] || data['final_score'] || 'N/A';

    // Parse modules if available
    if (data['modules'] && Array.isArray(data['modules'])) {
      this.modules = data['modules'];
    } else if (data['module_scores']) {
      // Alternative format
      this.modules = Object.entries(data['module_scores']).map(([name, score]) => ({
        name,
        score
      }));
    }
  }

  formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  switchTab(tab: 'certificate' | 'transcript'): void {
    if (tab === 'transcript' && !this.transcript) {
      return; // Don't switch if no transcript
    }
    this.activeTab = tab;
  }

  downloadCertificate(): void {
    if (!this.certificate) return;

    this.certificateService.downloadCertificateWithFilename(
      this.certificate.id,
      this.certificate.certificate_number
    );
  }

  downloadTranscript(): void {
    if (!this.transcript) return;

    this.certificateService.downloadCertificateWithFilename(
      this.transcript.id,
      this.transcript.certificate_number
    );
  }

  downloadBoth(): void {
    this.downloadCertificate();

    // Delay transcript download slightly to avoid browser blocking
    if (this.transcript) {
      setTimeout(() => {
        this.downloadTranscript();
      }, 500);
    }
  }

  toggleQRCode(): void {
    this.showQRCode = !this.showQRCode;
  }

  copyToClipboard(text: string, type: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${type} copied to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  goBack(): void {
    this.router.navigate(['/certificates/list']);
  }

  verifyCertificate(): void {
    if (!this.certificate) return;

    // Open verification in new window (if you have a verification page)
    const verificationUrl = `${window.location.origin}/verify/${this.certificate.verification_token}`;
    window.open(verificationUrl, '_blank');
  }

  shareCertificate(): void {
    if (!this.certificate) return;

    // Share functionality (could open share dialog or copy link)
    const shareUrl = `${window.location.origin}/certificates/${this.certificate.id}`;

    if (navigator.share) {
      navigator.share({
        title: `Certificate - ${this.courseTitle}`,
        text: `I earned a certificate for ${this.courseTitle}!`,
        url: shareUrl
      }).catch(err => console.log('Error sharing:', err));
    } else {
      this.copyToClipboard(shareUrl, 'Certificate link');
    }
  }

  getActiveDocument(): IssuedCertificateFull | null {
    return this.activeTab === 'certificate' ? this.certificate : this.transcript;
  }

  getCertificateTypeLabel(): string {
    return this.activeTab === 'certificate' ? 'Certificate of Completion' : 'Academic Transcript';
  }

  getGradeColor(): string {
    if (!this.grade || this.grade === 'N/A') return 'var(--dark-text-muted)';

    const gradeValue = parseFloat(this.grade);
    if (isNaN(gradeValue)) {
      // Letter grade
      if (this.grade.includes('A')) return '#10b981';
      if (this.grade.includes('B')) return '#06b6d4';
      if (this.grade.includes('C')) return '#f59e0b';
      return '#ef4444';
    }

    // Numeric grade (assuming out of 100)
    if (gradeValue >= 90) return '#10b981';
    if (gradeValue >= 80) return '#06b6d4';
    if (gradeValue >= 70) return '#f59e0b';
    return '#ef4444';
  }

  getStatusBadge(): { text: string; class: string } {
    if (!this.certificate) return { text: 'Unknown', class: 'status-unknown' };

    if (this.certificate.is_revoked) {
      return { text: 'Revoked', class: 'status-revoked' };
    }

    return { text: 'Valid', class: 'status-valid' };
  }
}
