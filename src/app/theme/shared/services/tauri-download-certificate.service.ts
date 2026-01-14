// src/app/core/services/tauri-download-certificate.service.ts

import { Injectable } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

/**
 * Response from Tauri save_certificate_file command
 */
export interface TauriSaveFileResult {
  success: boolean;
  file_path?: string;
  message: string;
}

/**
 * Response from Tauri save_multiple_certificates command
 */
export interface TauriSaveMultipleResult {
  success: boolean;
  folder_path?: string;
  files_saved: string[];
  message: string;
}

/**
 * File data for batch saving
 */
export interface CertificateFileData {
  filename: string;
  base64Data: string;
}

/**
 * Dedicated service for Tauri certificate download operations.
 * Handles native file save dialogs and file system operations.
 */
@Injectable({
  providedIn: 'root'
})
export class TauriDownloadCertificateService {

  constructor() {}

  /**
   * Check if the app is running in Tauri environment
   */
  isTauriApp(): boolean {
    return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
  }

  /**
   * Get Tauri invoke function
   */
  private getTauriInvoke(): any {
    if (!this.isTauriApp()) {
      throw new Error('Tauri is not available in this environment');
    }
    return (window as any).__TAURI__.core.invoke;
  }

  /**
   * Convert Blob to Base64 string
   */
  blobToBase64(blob: Blob): Observable<string> {
    return new Observable(observer => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1]; // Remove data:*/*;base64, prefix
        observer.next(base64String);
        observer.complete();
      };

      reader.onerror = (error) => {
        observer.error(new Error('Failed to convert blob to base64: ' + error));
      };

      reader.readAsDataURL(blob);
    });
  }

  /**
   * Save a single certificate file with native save dialog
   *
   * @param filename - Suggested filename (e.g., "certificate_CERT-2025-A7B3C2.pdf")
   * @param blob - File blob data
   * @returns Observable with save result including file path
   *
   * @example
   * this.tauriService.saveCertificateFile('certificate.pdf', pdfBlob)
   *   .subscribe({
   *     next: (result) => console.log('Saved to:', result.file_path),
   *     error: (err) => console.error('Save failed:', err)
   *   });
   */
  saveCertificateFile(filename: string, blob: Blob): Observable<TauriSaveFileResult> {
    if (!this.isTauriApp()) {
      return throwError(() => new Error('Tauri is not available. Use browser download instead.'));
    }

    return this.blobToBase64(blob).pipe(
      switchMap(base64Data => {
        const invoke = this.getTauriInvoke();
        return from(
          invoke('save_certificate_file', {
            filename,
            base64Data
          }) as Promise<TauriSaveFileResult>
        );
      }),
      catchError(error => {
        console.error('Tauri save_certificate_file error:', error);
        return throwError(() => new Error(`Failed to save file: ${error.message || error}`));
      })
    );
  }

  /**
   * Save multiple certificate files to a user-selected folder
   *
   * @param files - Array of file data with filename and blob
   * @returns Observable with save result including folder path and saved files
   *
   * @example
   * const files = [
   *   { filename: 'certificate.pdf', blob: certBlob },
   *   { filename: 'transcript.pdf', blob: transBlob }
   * ];
   * this.tauriService.saveMultipleCertificates(files)
   *   .subscribe({
   *     next: (result) => console.log('Saved to:', result.folder_path),
   *     error: (err) => console.error('Save failed:', err)
   *   });
   */
  saveMultipleCertificates(
    files: Array<{ filename: string; blob: Blob }>
  ): Observable<TauriSaveMultipleResult> {
    if (!this.isTauriApp()) {
      return throwError(() => new Error('Tauri is not available. Use browser download instead.'));
    }

    // Convert all blobs to base64
    const conversionPromises = files.map(file =>
      this.blobToBase64(file.blob).toPromise().then(base64Data => ({
        filename: file.filename,
        base64Data: base64Data!
      }))
    );

    return from(Promise.all(conversionPromises)).pipe(
      switchMap(fileDataArray => {
        const invoke = this.getTauriInvoke();

        // Convert to array of tuples for Rust
        const filesParam = fileDataArray.map(f => [f.filename, f.base64Data]);

        return from(
          invoke('save_multiple_certificates', {
            files: filesParam
          }) as Promise<TauriSaveMultipleResult>
        );
      }),
      catchError(error => {
        console.error('Tauri save_multiple_certificates error:', error);
        return throwError(() => new Error(`Failed to save files: ${error.message || error}`));
      })
    );
  }

  /**
   * Get the last save directory used by the user
   * Useful for pre-populating the save dialog
   */
  getLastSaveDirectory(): Observable<string | null> {
    if (!this.isTauriApp()) {
      return of(null);
    }

    const invoke = this.getTauriInvoke();

    return from(
      invoke('get_last_save_directory') as Promise<string | null>
    ).pipe(
      catchError(error => {
        console.warn('Failed to get last save directory:', error);
        return of(null);
      })
    );
  }

  /**
   * Set the last save directory for future use
   */
  setLastSaveDirectory(directory: string): Observable<void> {
    if (!this.isTauriApp()) {
      return of(undefined);
    }

    const invoke = this.getTauriInvoke();

    return from(
      invoke('set_last_save_directory', { directory }) as Promise<void>
    ).pipe(
      catchError(error => {
        console.warn('Failed to set last save directory:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Helper method to extract directory path from full file path
   */
  extractDirectoryPath(filePath: string): string {
    // Handle Windows paths (C:\Users\...) and Unix paths (/home/...)
    const lastSlashIndex = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\')
    );

    return lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : filePath;
  }

  /**
   * Save certificate and automatically remember the directory
   */
  saveCertificateWithMemory(filename: string, blob: Blob): Observable<TauriSaveFileResult> {
    return this.saveCertificateFile(filename, blob).pipe(
      map(result => {
        // Remember the directory if save was successful
        if (result.success && result.file_path) {
          const directory = this.extractDirectoryPath(result.file_path);
          this.setLastSaveDirectory(directory).subscribe();
        }
        return result;
      })
    );
  }

  /**
   * Save multiple certificates and automatically remember the directory
   */
  saveMultipleCertificatesWithMemory(
    files: Array<{ filename: string; blob: Blob }>
  ): Observable<TauriSaveMultipleResult> {
    return this.saveMultipleCertificates(files).pipe(
      map(result => {
        // Remember the folder if save was successful
        if (result.success && result.folder_path) {
          this.setLastSaveDirectory(result.folder_path).subscribe();
        }
        return result;
      })
    );
  }
}
