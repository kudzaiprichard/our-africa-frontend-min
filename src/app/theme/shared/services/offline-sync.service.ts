import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import { TauriDatabaseService } from './tauri-database.service';
import { BaseHttpService } from '../../../libs/core';

interface SyncQueueItem {
  id: number;
  operation_type: 'create' | 'update' | 'delete';
  table_name: string;
  record_id: string;
  data: any;
  retry_count: number;
  error_message?: string;
}

interface OfflineProgressBatch {
  id: number;
  session_id: string;
  course_id: string;
  batch_data: any;
  created_at: string;
  synced: boolean;
  synced_at?: string;
}

/**
 * Offline Sync Service - Handles MANUAL synchronization of offline progress
 *
 * IMPORTANT: Auto-sync has been DISABLED. All syncing must be explicitly triggered by the user.
 * This gives users full control over when their progress is synchronized to the server.
 */
@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  private syncProgressSubject = new BehaviorSubject<number>(0);

  public isSyncing$ = this.isSyncingSubject.asObservable();
  public syncProgress$ = this.syncProgressSubject.asObservable();

  constructor(
    private connectivityService: ConnectivityService,
    private tauriDb: TauriDatabaseService,
    private baseHttp: BaseHttpService
  ) {
    // ✅ NO AUTO-SYNC - User controls when to sync
    console.log('ℹ️ OfflineSyncService initialized - Auto-sync is DISABLED');
    console.log('💡 Users must manually trigger sync via syncAll() method');
  }

  // ============================================================================
  // MANUAL SYNC ORCHESTRATION
  // ============================================================================

  /**
   * Manually trigger full sync (called by user action only)
   * Syncs all offline progress batches to the server
   */
  async syncAll(): Promise<void> {
    if (this.isSyncingSubject.value) {
      console.log('⏳ Sync already in progress');
      return;
    }

    if (this.connectivityService.isOffline()) {
      console.log('📵 Cannot sync while offline');
      throw new Error('Cannot sync while offline. Please check your internet connection.');
    }

    this.isSyncingSubject.next(true);
    this.syncProgressSubject.next(0);

    try {
      console.log('🔄 Starting manual sync...');

      // Sync offline progress batches using /sync-offline endpoint
      const batchResult = await this.syncOfflineProgressBatches();
      console.log(`✅ Progress batch sync: ${batchResult.syncedBatches}/${batchResult.totalBatches} succeeded`);

      if (batchResult.failedBatches > 0) {
        console.warn(`⚠️ ${batchResult.failedBatches} batches failed to sync`);
      }

      // Update last sync time
      await this.tauriDb.setLastSyncTime();

      this.syncProgressSubject.next(100);
      console.log('✅ Manual sync completed successfully');

    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      this.isSyncingSubject.next(false);
      this.syncProgressSubject.next(0);
    }
  }

  // ============================================================================
  // OFFLINE PROGRESS BATCH SYNC
  // ============================================================================

  /**
   * Sync all unsynced progress batches using the /sync-offline endpoint
   */
  async syncOfflineProgressBatches(): Promise<SyncBatchResult> {
    if (this.connectivityService.isOffline()) {
      console.log('📵 Cannot sync progress batches while offline');
      return {
        totalBatches: 0,
        syncedBatches: 0,
        failedBatches: 0,
        failedBatchIds: []
      };
    }

    try {
      const batches = await this.tauriDb.getUnsyncedProgressBatches(50);
      console.log(`📤 Syncing ${batches.length} progress batches...`);

      if (batches.length === 0) {
        console.log('✅ No progress batches to sync');
        return {
          totalBatches: 0,
          syncedBatches: 0,
          failedBatches: 0,
          failedBatchIds: []
        };
      }

      const result: SyncBatchResult = {
        totalBatches: batches.length,
        syncedBatches: 0,
        failedBatches: 0,
        failedBatchIds: []
      };

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i] as OfflineProgressBatch;

        try {
          const endpoint = `/api/student/courses/${batch.course_id}/sync-offline`;

          const request = {
            course_id: batch.course_id,
            offline_session_id: batch.session_id,
            downloaded_at: batch.created_at,
            synced_at: new Date().toISOString(),
            progress_data: batch.batch_data
          };

          console.log(`🔄 Syncing batch ${i + 1}/${batches.length} for course ${batch.course_id}...`);

          await this.baseHttp.post(endpoint, request).toPromise();

          await this.tauriDb.markBatchAsSynced(batch.id);
          result.syncedBatches++;

          console.log(`✅ Progress batch ${batch.id} synced successfully`);

          const progress = Math.round(((i + 1) / batches.length) * 100);
          this.syncProgressSubject.next(progress);

        } catch (error: any) {
          console.error(`❌ Failed to sync batch ${batch.id}:`, error);
          result.failedBatches++;
          result.failedBatchIds.push(batch.id);

          if (error.details && Array.isArray(error.details)) {
            console.error(`   Error details: ${error.details.join(', ')}`);
          }
        }
      }

      console.log(`✅ Progress batch sync completed: ${result.syncedBatches}/${result.totalBatches} succeeded`);
      return result;

    } catch (error) {
      console.error('❌ Failed to sync progress batches:', error);
      throw error;
    }
  }

  /**
   * Sync a single progress batch by ID
   */
  async syncSingleBatch(batchId: number): Promise<boolean> {
    if (this.connectivityService.isOffline()) {
      console.log('📵 Cannot sync while offline');
      return false;
    }

    try {
      const batches = await this.tauriDb.getUnsyncedProgressBatches(1000);
      const batch = batches.find((b: OfflineProgressBatch) => b.id === batchId);

      if (!batch) {
        console.warn(`⚠️ Batch ${batchId} not found or already synced`);
        return false;
      }

      const endpoint = `/api/student/courses/${batch.course_id}/sync-offline`;

      const request = {
        course_id: batch.course_id,
        offline_session_id: batch.session_id,
        downloaded_at: batch.created_at,
        synced_at: new Date().toISOString(),
        progress_data: batch.batch_data
      };

      await this.baseHttp.post(endpoint, request).toPromise();
      await this.tauriDb.markBatchAsSynced(batch.id);

      console.log(`✅ Batch ${batchId} synced successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to sync batch ${batchId}:`, error);
      return false;
    }
  }

  // ============================================================================
  // CLEANUP & MAINTENANCE
  // ============================================================================

  /**
   * Clean up old synced progress batches (older than specified days)
   */
  async cleanupSyncedBatches(daysOld: number = 30): Promise<number> {
    try {
      const deletedCount = await this.tauriDb.deleteSyncedProgressBatches(daysOld);
      console.log(`🗑️ Deleted ${deletedCount} old synced progress batches`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup synced batches:', error);
      return 0;
    }
  }

  /**
   * Delete expired offline sessions
   */
  async cleanupExpiredSessions(daysOld: number = 7): Promise<number> {
    try {
      const deletedCount = await this.tauriDb.deleteExpiredOfflineSessions(daysOld);
      console.log(`🗑️ Deleted ${deletedCount} expired offline sessions`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Perform full cleanup (synced batches + expired sessions)
   */
  async performFullCleanup(): Promise<CleanupResult> {
    console.log('🧹 Starting full cleanup...');

    const result: CleanupResult = {
      deletedBatches: 0,
      deletedSessions: 0,
      success: true,
      errors: []
    };

    try {
      result.deletedBatches = await this.cleanupSyncedBatches(30);
    } catch (error) {
      result.success = false;
      result.errors.push(`Batch cleanup failed: ${error}`);
    }

    try {
      result.deletedSessions = await this.cleanupExpiredSessions(7);
    } catch (error) {
      result.success = false;
      result.errors.push(`Session cleanup failed: ${error}`);
    }

    console.log(`🧹 Cleanup complete: ${result.deletedBatches} batches, ${result.deletedSessions} sessions deleted`);
    return result;
  }

  // ============================================================================
  // STATISTICS & MONITORING
  // ============================================================================

  /**
   * Get sync queue count (legacy - deprecated)
   */
  async getSyncQueueCount(): Promise<number> {
    try {
      return await this.tauriDb.getSyncQueueCount();
    } catch (error) {
      console.error('❌ Failed to get sync queue count:', error);
      return 0;
    }
  }

  /**
   * Get unsynced progress batch count
   */
  async getUnsyncedBatchCount(): Promise<number> {
    try {
      const batches = await this.tauriDb.getUnsyncedProgressBatches(1000);
      return batches.length;
    } catch (error) {
      console.error('❌ Failed to get unsynced batch count:', error);
      return 0;
    }
  }

  /**
   * Get offline session statistics
   */
  async getOfflineStatistics(): Promise<any> {
    try {
      return await this.tauriDb.getOfflineSessionStatistics();
    } catch (error) {
      console.error('❌ Failed to get offline statistics:', error);
      return null;
    }
  }

  /**
   * Get comprehensive sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const unsyncedBatches = await this.getUnsyncedBatchCount();
    const stats = await this.getOfflineStatistics();
    const lastSyncTime = await this.tauriDb.getLastSyncTime();

    return {
      isSyncing: this.isSyncingSubject.value,
      unsyncedBatches,
      activeSessions: stats?.active_sessions || 0,
      expiredSessions: stats?.expired_sessions || 0,
      lastSyncTime,
      isOnline: this.connectivityService.isOnline()
    };
  }

  // ============================================================================
  // LEGACY SUPPORT (DEPRECATED)
  // ============================================================================

  /**
   * Clear sync queue (use with caution)
   * @deprecated Use cleanupSyncedBatches() instead
   */
  async clearSyncQueue(): Promise<void> {
    console.warn('⚠️ clearSyncQueue() is deprecated. Use cleanupSyncedBatches() instead.');
    await this.tauriDb.clearSyncQueue();
    console.log('🗑️ Sync queue cleared');
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface SyncBatchResult {
  totalBatches: number;
  syncedBatches: number;
  failedBatches: number;
  failedBatchIds: number[];
}

export interface CleanupResult {
  deletedBatches: number;
  deletedSessions: number;
  success: boolean;
  errors: string[];
}

export interface SyncStatus {
  isSyncing: boolean;
  unsyncedBatches: number;
  activeSessions: number;
  expiredSessions: number;
  lastSyncTime: string | null;
  isOnline: boolean;
}
