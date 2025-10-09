/**
 * Error details structure that matches backend ErrorDetail class
 */
export interface ErrorDetail {
  title: string;
  details?: string[];
  field_errors?: { [key: string]: string[] };
  status: number;
}
