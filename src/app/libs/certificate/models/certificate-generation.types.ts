// src/types/certificates/certificate-generation.types.ts

export interface ModulePerformance {
  name: string;
  score: number;
  grade: string;
}

export interface PerformanceData {
  overall_grade: string;
  average_score: number;
  modules: ModulePerformance[];
}

export interface CertificateRecordBasic {
  id: string;
  certificate_number: string;
  certificate_type: 'CERTIFICATE' | 'TRANSCRIPT';
  user_id: string;
  course_id: string;
  completion_date: string;
  issue_date: string;
  status: 'valid' | 'revoked' | 'suspended';
  verification_hash: string;
  qr_data: string;
  created_at: string;
}

export interface CertificateRecordFull {
  id: string;
  certificate_number: string;
  certificate_type: 'CERTIFICATE' | 'TRANSCRIPT';
  user_id: string;
  course_id: string;
  completion_date: string;
  issue_date: string;
  status: 'valid' | 'revoked' | 'suspended';
  verification_hash: string;
  qr_data: string;
  performance_data: PerformanceData;
  student_name: string;
  course_title: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateCertificateRecordsResponse {
  certificate_record: CertificateRecordFull;
  transcript_record: CertificateRecordFull;
}

export interface GetMyCertificateRecordsResponse {
  certificate_records: CertificateRecordBasic[];
}

export interface GetCertificateByCourseResponse {
  has_certificate: boolean;
  certificate_record?: CertificateRecordBasic;
  transcript_record?: CertificateRecordBasic;
}

export interface CompletionStatus {
  overall_percentage: number;
  modules_completed_percentage: number;
  quizzes_passed_percentage: number;
  final_exam_passed: boolean;
}

export interface CheckEligibilityResponse {
  eligible: boolean;
  message: string;
  missing_requirements: string[];
  completion_status: CompletionStatus;
}

export interface VerifyCertificateResponse {
  is_valid: boolean;
  message: string;
  certificate_record?: CertificateRecordFull;
}

export type CertificateType = 'CERTIFICATE' | 'TRANSCRIPT';
export type CertificateStatus = 'valid' | 'revoked' | 'suspended';
export type DownloadFormat = 'pdf' | 'png';
