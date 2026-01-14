// src/app/shared/services/certificate-generation.service.ts

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root'
})
export class CertificateGenerationService {

  constructor(private baseHttpService: BaseHttpService) {}

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
   */
  downloadCertificate(certificateRecordId: string, format: DownloadFormat = 'pdf'): Observable<Blob> {
    const endpoint = API_ENDPOINTS.STUDENT.CERTIFICATE_GENERATION.DOWNLOAD(certificateRecordId);
    const params = new HttpParams().set('format', format);
    return this.baseHttpService.downloadFile(endpoint, params);
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
