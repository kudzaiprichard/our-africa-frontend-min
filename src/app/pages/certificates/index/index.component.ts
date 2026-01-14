// src/app/pages/certificates/index.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { EnrollmentWithCourseAndProgress, StudentCourseService } from '../../../libs/course';
import {
  CertificateGenerationService,
  CertificateRecordFull,
  GetCertificateByCourseResponse
} from '../../../libs/certificate';
import { ToastsService } from '../../../theme/shared';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './index.component.html',
  styleUrl: './index.component.scss'
})
export class IndexComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  completedCourses: EnrollmentWithCourseAndProgress[] = [];
  selectedCourseId: string = '';

  isLoadingCourses = false;
  isGenerating = false;
  isLoadingPreview = false;

  certificateRecord: CertificateRecordFull | null = null;
  transcriptRecord: CertificateRecordFull | null = null;

  certificatePreviewUrl: string | null = null;
  transcriptPreviewUrl: string | null = null;

  activeTab: 'certificate' | 'transcript' = 'certificate';
  showPreview = false;

  error: string | null = null;

  constructor(
    private courseService: StudentCourseService,
    private certificateService: CertificateGenerationService,
    private toasts: ToastsService
  ) {}

  ngOnInit(): void {
    this.loadCompletedCourses();
  }

  ngOnDestroy(): void {
    this.revokePreviewUrls();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCompletedCourses(): void {
    this.isLoadingCourses = true;
    this.error = null;

    this.courseService.getMyEnrollments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.completedCourses = response.enrollments.filter(e =>
            e.status === 'completed' || !!e.completed_at
          );

          if (this.completedCourses.length === 0) {
            this.error = 'No completed courses found. Complete a course to earn certificates!';
          }

          this.isLoadingCourses = false;
        },
        error: (err) => {
          this.error = 'Failed to load completed courses';
          this.isLoadingCourses = false;
          this.toasts.error('Unable to load your completed courses.');
        }
      });
  }

  onCourseSelect(): void {
    if (!this.selectedCourseId) {
      this.resetState();
      return;
    }

    this.resetState();
    this.checkCertificateStatus();
  }

  checkCertificateStatus(): void {
    this.certificateService.getCertificateByCourse(this.selectedCourseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GetCertificateByCourseResponse) => {
          if (response.has_certificate) {
            this.certificateRecord = response.certificate_record as CertificateRecordFull;
            this.transcriptRecord = response.transcript_record as CertificateRecordFull;
            this.loadClaimedPreview();
          }
        },
        error: (err) => {
          this.toasts.error('Unable to check certificate status.');
        }
      });
  }

  claimCertificate(): void {
    if (!this.selectedCourseId) {
      this.toasts.error('Please select a course first');
      return;
    }

    this.isGenerating = true;

    this.certificateService.generateCertificates(this.selectedCourseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.certificateRecord = response.certificate_record;
          this.transcriptRecord = response.transcript_record;
          this.toasts.success('🎉 Congratulations! Certificates generated successfully!');
          this.isGenerating = false;
          this.loadClaimedPreview();
        },
        error: (err) => {
          this.toasts.error('Failed to generate certificates. Please try again.');
          this.isGenerating = false;
        }
      });
  }

  private loadClaimedPreview(): void {
    if (!this.certificateRecord || !this.transcriptRecord) {
      this.toasts.error('Certificate records not found');
      return;
    }

    this.isLoadingPreview = true;
    this.revokePreviewUrls();

    const certificateId = this.certificateRecord.id;
    const transcriptId = this.transcriptRecord.id;

    this.certificateService.downloadCertificate(certificateId, 'png')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          if (blob.size === 0) {
            this.toasts.error('Failed to load certificate preview');
            this.isLoadingPreview = false;
            return;
          }

          this.certificatePreviewUrl = URL.createObjectURL(blob);
          this.loadTranscriptPreviewClaimed(transcriptId);
        },
        error: (err) => {
          const errorMsg = err.details?.[0] || err.message || 'Failed to load certificate preview';
          this.toasts.error(errorMsg);
          this.isLoadingPreview = false;
        }
      });
  }

  private loadTranscriptPreviewClaimed(transcriptId: string): void {
    this.certificateService.downloadCertificate(transcriptId, 'png')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          if (blob.size === 0) {
            this.toasts.error('Failed to load transcript preview');
            this.isLoadingPreview = false;
            return;
          }

          this.transcriptPreviewUrl = URL.createObjectURL(blob);
          this.showPreview = true;
          this.isLoadingPreview = false;
        },
        error: (err) => {
          const errorMsg = err.details?.[0] || err.message || 'Failed to load transcript preview';
          this.toasts.error(errorMsg);
          this.isLoadingPreview = false;
        }
      });
  }

  switchTab(tab: 'certificate' | 'transcript'): void {
    this.activeTab = tab;
  }

  downloadCertificate(): void {
    if (!this.certificateRecord?.id) {
      this.toasts.error('Certificate not found');
      return;
    }

    const certId = this.certificateRecord.id;
    const certNumber = this.certificateRecord.certificate_number;

    this.certificateService.downloadCertificate(certId, 'pdf')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          if (blob.size === 0) {
            this.toasts.error('Failed to download certificate');
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `certificate_${certNumber}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
          this.toasts.success('Certificate downloaded!');
        },
        error: (err) => {
          const errorMsg = err.details?.[0] || err.message || 'Failed to download certificate';
          this.toasts.error(errorMsg);
        }
      });
  }

  downloadTranscript(): void {
    if (!this.transcriptRecord?.id) {
      this.toasts.error('Transcript not found');
      return;
    }

    const transcriptId = this.transcriptRecord.id;
    const transcriptNumber = this.transcriptRecord.certificate_number;

    this.certificateService.downloadCertificate(transcriptId, 'pdf')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          if (blob.size === 0) {
            this.toasts.error('Failed to download transcript');
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `transcript_${transcriptNumber}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
          this.toasts.success('Transcript downloaded!');
        },
        error: (err) => {
          const errorMsg = err.details?.[0] || err.message || 'Failed to download transcript';
          this.toasts.error(errorMsg);
        }
      });
  }

  downloadBoth(): void {
    this.downloadCertificate();
    setTimeout(() => {
      this.downloadTranscript();
    }, 500);
  }

  private revokePreviewUrls(): void {
    if (this.certificatePreviewUrl) {
      URL.revokeObjectURL(this.certificatePreviewUrl);
      this.certificatePreviewUrl = null;
    }
    if (this.transcriptPreviewUrl) {
      URL.revokeObjectURL(this.transcriptPreviewUrl);
      this.transcriptPreviewUrl = null;
    }
  }

  private resetState(): void {
    this.certificateRecord = null;
    this.transcriptRecord = null;
    this.showPreview = false;
    this.activeTab = 'certificate';
    this.revokePreviewUrls();
  }

  get selectedCourse(): EnrollmentWithCourseAndProgress | undefined {
    return this.completedCourses.find(c => c.course_id === this.selectedCourseId);
  }

  get hasCertificates(): boolean {
    return !!this.certificateRecord && !!this.transcriptRecord;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
