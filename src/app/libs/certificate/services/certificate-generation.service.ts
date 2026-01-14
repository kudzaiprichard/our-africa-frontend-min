// src/app/shared/services/certificate-generation.service.ts

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { HttpParams } from '@angular/common/http';
import { BaseHttpService, API_ENDPOINTS } from '../../core';

import {
  CertificateRecordFull,
  GenerateCertificateRecordsResponse,
  GetMyCertificateRecordsResponse,
  GetCertificateByCourseResponse,
  CheckEligibilityResponse,
  VerifyCertificateResponse,
  DownloadFormat
} from '../models/certificate-generation.types';
import {TauriDownloadCertificateService} from '../../../theme/shared/services/tauri-download-certificate.service';

/**
 * Result from certificate download operation
 * Works for both browser and Tauri downloads
 */
export interface CertificateDownloadResult {
  success: boolean;
  platform: 'browser' | 'tauri';
  filePath?: string;        // Tauri only - where file was saved
  fileName?: string;        // Browser only - downloaded filename
  message: string;
  cancelled?: boolean;      // True if user cancelled save dialog
}

@Injectable({
  providedIn: 'root'
})
export class CertificateGenerationService {

  constructor(
    private baseHttpService: BaseHttpService,
    private tauriDownloadService: TauriDownloadCertificateService
  ) {}

  /**
   * Check if running in Tauri environment
   */
  isTauriEnvironment(): boolean {
    return this.tauriDownloadService.isTauriApp();
  }

  /**
   * Preview certificate as PNG before claiming (uses course_id, not certificate_record_id)
   */
  previewCertificate(courseId: string): Observable<Blob> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.PREVIEW_CERTIFICATE(courseId);
    return this.baseHttpService.downloadFile(endpoint);
  }

  /**
   * Preview transcript as PNG before claiming (uses course_id, not certificate_record_id)
   */
  previewTranscript(courseId: string): Observable<Blob> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.PREVIEW_TRANSCRIPT(courseId);
    return this.baseHttpService.downloadFile(endpoint);
  }

  /**
   * Generate and save certificate records (both certificate and transcript)
   */
  generateCertificates(courseId: string): Observable<GenerateCertificateRecordsResponse> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.GENERATE(courseId);
    return this.baseHttpService.post<GenerateCertificateRecordsResponse>(endpoint, {}).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Download certificate or transcript as PDF or PNG (uses certificate_record_id)
   * Returns blob for internal use (preview, etc.)
   */
  downloadCertificate(certificateRecordId: string, format: DownloadFormat = 'pdf'): Observable<Blob> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.DOWNLOAD(certificateRecordId);
    const params = new HttpParams().set('format', format);
    return this.baseHttpService.downloadFile(endpoint, params);
  }

  /**
   * Download certificate with platform-specific handling
   * - Tauri: Shows native save dialog, user chooses location
   * - Browser: Downloads to default Downloads folder
   *
   * @param certificateRecordId - Certificate record ID
   * @param suggestedFilename - Suggested filename (e.g., "certificate_CERT-2025-A7B3C2.pdf")
   * @param format - File format (pdf or png)
   */
  downloadCertificateWithDialog(
    certificateRecordId: string,
    suggestedFilename: string,
    format: DownloadFormat = 'pdf'
  ): Observable<CertificateDownloadResult> {
    // Get the blob first
    return this.downloadCertificate(certificateRecordId, format).pipe(
      switchMap(blob => {
        if (this.isTauriEnvironment()) {
          // Tauri: Use native save dialog
          return this.tauriDownloadService.saveCertificateWithMemory(suggestedFilename, blob).pipe(
            map(result => ({
              success: result.success,
              platform: 'tauri' as const,
              filePath: result.file_path,
              message: result.message,
              cancelled: !result.success && result.message.toLowerCase().includes('cancel')
            }))
          );
        } else {
          // Browser: Traditional download
          this.triggerBrowserDownload(blob, suggestedFilename);
          return of({
            success: true,
            platform: 'browser' as const,
            fileName: suggestedFilename,
            message: `Downloaded ${suggestedFilename}`
          });
        }
      })
    );
  }

  /**
   * Download multiple certificates (certificate + transcript) with platform-specific handling
   * - Tauri: Shows folder picker, saves both files to chosen folder
   * - Browser: Downloads both files sequentially to Downloads folder
   *
   * @param certificateId - Certificate record ID
   * @param transcriptId - Transcript record ID
   * @param certificateFilename - Certificate filename
   * @param transcriptFilename - Transcript filename
   * @param format - File format (pdf or png)
   */
  downloadMultipleCertificates(
    certificateId: string,
    transcriptId: string,
    certificateFilename: string,
    transcriptFilename: string,
    format: DownloadFormat = 'pdf'
  ): Observable<CertificateDownloadResult> {
    // Get both blobs first
    const cert$ = this.downloadCertificate(certificateId, format);
    const trans$ = this.downloadCertificate(transcriptId, format);

    return cert$.pipe(
      switchMap(certBlob => trans$.pipe(
        switchMap(transBlob => {
          if (this.isTauriEnvironment()) {
            // Tauri: Use folder picker and save both
            const files = [
              { filename: certificateFilename, blob: certBlob },
              { filename: transcriptFilename, blob: transBlob }
            ];

            return this.tauriDownloadService.saveMultipleCertificatesWithMemory(files).pipe(
              map(result => ({
                success: result.success,
                platform: 'tauri' as const,
                filePath: result.folder_path,
                message: result.success
                  ? `Saved ${result.files_saved.length} files to: ${result.folder_path}`
                  : result.message,
                cancelled: !result.success && result.message.toLowerCase().includes('cancel')
              }))
            );
          } else {
            // Browser: Download both files sequentially
            this.triggerBrowserDownload(certBlob, certificateFilename);
            setTimeout(() => {
              this.triggerBrowserDownload(transBlob, transcriptFilename);
            }, 500); // Small delay to avoid browser blocking multiple downloads

            return of({
              success: true,
              platform: 'browser' as const,
              fileName: `${certificateFilename} and ${transcriptFilename}`,
              message: 'Downloaded certificate and transcript'
            });
          }
        })
      ))
    );
  }

  /**
   * Trigger browser download for blob
   * Creates temporary <a> tag and clicks it
   */
  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get all my certificate records
   */
  getMyCertificates(): Observable<GetMyCertificateRecordsResponse> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.MY_CERTIFICATES;
    return this.baseHttpService.get<GetMyCertificateRecordsResponse>(endpoint).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Get certificate record details
   */
  getCertificateDetails(certificateRecordId: string): Observable<CertificateRecordFull> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.RECORD_DETAILS(certificateRecordId);
    return this.baseHttpService.get<{ certificate_record: CertificateRecordFull }>(endpoint).pipe(
      map(response => response.value!.certificate_record)
    );
  }

  /**
   * Get certificate and transcript records for a specific course
   */
  getCertificateByCourse(courseId: string): Observable<GetCertificateByCourseResponse> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.BY_COURSE(courseId);
    return this.baseHttpService.get<GetCertificateByCourseResponse>(endpoint).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Check eligibility for certificate
   */
  checkEligibility(courseId: string): Observable<CheckEligibilityResponse> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.ELIGIBILITY(courseId);
    return this.baseHttpService.get<CheckEligibilityResponse>(endpoint).pipe(
      map(response => response.value!)
    );
  }

  /**
   * Verify certificate by certificate number
   */
  verifyCertificate(certificateNumber: string): Observable<VerifyCertificateResponse> {
    const endpoint = API_ENDPOINTS.CERTIFICATES.VERIFY_BY_NUMBER(certificateNumber);
    return this.baseHttpService.get<VerifyCertificateResponse>(endpoint).pipe(
      map(response => response.value!)
    );
  }
}
