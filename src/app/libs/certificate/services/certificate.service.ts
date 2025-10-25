import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseHttpService, API_ENDPOINTS } from '../../core';

// Certificate DTOs
import {
  GetMyCertificatesResponse,
  GetCertificateDetailsResponse,
  GetCertificateByCourseResponse,
  ClaimCertificateResponse
} from '../models/certificates.dtos.interface';

/**
 * Certificate Service - Handles all certificate-related operations
 * Manages certificate listing, viewing, downloading, and claiming
 */
@Injectable({
  providedIn: 'root'
})
export class CertificateService {

  constructor(private baseHttpService: BaseHttpService) {}

  // ========== CERTIFICATE MANAGEMENT ==========

  /**
   * Get all certificates for the current student
   * Returns both certificates and transcripts
   */
  getMyCertificates(): Observable<GetMyCertificatesResponse> {
    return this.baseHttpService.get<GetMyCertificatesResponse>(
      API_ENDPOINTS.STUDENT.CERTIFICATES
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get detailed information about a specific certificate
   * Includes all certificate data, student name, course title, etc.
   */
  getCertificateDetails(certificateId: string): Observable<GetCertificateDetailsResponse> {
    return this.baseHttpService.get<GetCertificateDetailsResponse>(
      API_ENDPOINTS.STUDENT.CERTIFICATE_DETAILS(certificateId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get certificate for a specific course
   * Returns 404 if no certificate issued for the course yet
   */
  getCertificateByCourse(courseId: string): Observable<GetCertificateByCourseResponse> {
    return this.baseHttpService.get<GetCertificateByCourseResponse>(
      API_ENDPOINTS.STUDENT.CERTIFICATE_BY_COURSE(courseId)
    ).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Download certificate as PDF
   * Returns the PDF blob for download
   */
  downloadCertificate(certificateId: string): Observable<Blob> {
    return this.baseHttpService.downloadFile(
      API_ENDPOINTS.STUDENT.CERTIFICATE_DOWNLOAD(certificateId)
    );
  }

  /**
   * Claim certificate for a completed course
   * Issues both certificate and transcript if eligible
   *
   * Returns:
   * - 201: Certificates issued successfully
   * - 400: Not eligible (returns missing requirements)
   * - 409: Certificate already issued
   */
  claimCertificate(courseId: string): Observable<ClaimCertificateResponse> {
    return this.baseHttpService.post<ClaimCertificateResponse>(
      API_ENDPOINTS.STUDENT.CERTIFICATE_CLAIM(courseId),
      {} // Empty body - courseId is in URL
    ).pipe(
      map(response => response.value!)
    );
  }

  // ========== UTILITY METHODS ==========

  /**
   * Check if student has certificate for a course
   * Helper method to quickly check certificate availability
   */
  hasCertificateForCourse(courseId: string): Observable<boolean> {
    return this.getCertificateByCourse(courseId).pipe(
      map(() => true),
      // catchError to handle 404 would return false, but let component handle errors
    );
  }

  /**
   * Download certificate with automatic filename
   * Triggers browser download with proper filename
   */
  downloadCertificateWithFilename(certificateId: string, certificateNumber: string): void {
    this.downloadCertificate(certificateId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `certificate_${certificateNumber}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Failed to download certificate:', error);
      }
    });
  }

  /**
   * Get certificate type display name
   * Converts 'CERTIFICATE' or 'TRANSCRIPT' to readable format
   */
  getCertificateTypeDisplayName(type: string): string {
    return type === 'CERTIFICATE' ? 'Certificate of Completion' : 'Academic Transcript';
  }

  /**
   * Format certificate issue date
   * Converts ISO string to readable format
   */
  formatIssueDate(isoDate: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
