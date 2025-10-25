// ============================================================================
// CERTIFICATE DATA STRUCTURES (Building Blocks)
// ============================================================================

export interface IssuedCertificateBasic {
  id: string;
  certificate_number: string;
  certificate_type: 'CERTIFICATE' | 'TRANSCRIPT';
  user_id: string;
  course_id: string;
  issued_date: string;
  is_revoked: boolean;
  verification_token: string;
  qr_code_url?: string;
  created_at: string;
}

export interface IssuedCertificateFull {
  id: string;
  certificate_number: string;
  certificate_type: 'CERTIFICATE' | 'TRANSCRIPT';
  template_id: string;
  user_id: string;
  course_id: string;
  issued_date: string;
  data: Record<string, any>; // Certificate dynamic data (name, scores, etc.)
  verification_token: string;
  qr_code_url?: string;
  is_revoked: boolean;
  student_name?: string;
  course_title?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ESSENTIAL STUDENT CERTIFICATE OPERATIONS
// ============================================================================

// GET /api/student/certificates - List all my certificates
export interface GetMyCertificatesResponse {
  certificates: IssuedCertificateBasic[];
}

// GET /api/student/certificates/<certificate_id> - View/get certificate details
export interface GetCertificateDetailsResponse {
  certificate: IssuedCertificateFull;
}

// GET /api/student/certificates/course/<course_id> - Get certificate by course
export interface GetCertificateByCourseResponse {
  certificate: IssuedCertificateFull;
}

// POST /api/student/certificates/course/<course_id>/claim
export interface ClaimCertificateResponse {
  certificate: IssuedCertificateFull;
  transcript: IssuedCertificateFull;
}

// Note: Download endpoint (GET /api/student/certificates/<certificate_id>/download)
// returns PDF blob directly, no TypeScript interface needed
