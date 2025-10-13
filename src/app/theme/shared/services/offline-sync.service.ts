import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';
import { ConnectivityService } from './connectivity.service';
import { TauriDatabaseService } from './tauri-database.service';
import {BaseHttpService} from '../../../libs/core';

interface SyncQueueItem {
  id: number;
  operation_type: 'create' | 'update' | 'delete';
  table_name: string;
  record_id: string;
  data: any;
  retry_count: number;
  error_message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  private syncProgressSubject = new BehaviorSubject<number>(0);
  private syncSubscription?: Subscription;

  public isSyncing$ = this.isSyncingSubject.asObservable();
  public syncProgress$ = this.syncProgressSubject.asObservable();

  constructor(
    private connectivityService: ConnectivityService,
    private tauriDb: TauriDatabaseService,
    private baseHttp: BaseHttpService
  ) {
    this.initializeAutoSync();
  }

  /**
   * Initialize automatic sync when connection is restored
   */
  private initializeAutoSync(): void {
    // Listen for connectivity changes
    this.connectivityService.getOnlineStatus()
      .pipe(
        filter(isOnline => isOnline), // Only trigger when going online
        tap(() => console.log('🔄 Connection restored, starting auto-sync...'))
      )
      .subscribe(() => {
        this.syncAll();
      });

    // Periodic sync every 5 minutes when online
    interval(5 * 60 * 1000) // 5 minutes
      .pipe(
        filter(() => this.connectivityService.isOnline()),
        filter(() => !this.isSyncingSubject.value)
      )
      .subscribe(() => {
        this.syncAll();
      });
  }

  /**
   * Manually trigger sync
   */
  async syncAll(): Promise<void> {
    if (this.isSyncingSubject.value) {
      console.log('⏳ Sync already in progress');
      return;
    }

    if (this.connectivityService.isOffline()) {
      console.log('📵 Cannot sync while offline');
      return;
    }

    this.isSyncingSubject.next(true);
    this.syncProgressSubject.next(0);

    try {
      const queueItems = await this.tauriDb.getSyncQueue(100);
      console.log(`📤 Syncing ${queueItems.length} items...`);

      if (queueItems.length === 0) {
        console.log('✅ Sync queue is empty');
        return;
      }

      const totalItems = queueItems.length;
      let syncedCount = 0;
      const failedItems: number[] = [];

      for (const item of queueItems) {
        try {
          await this.syncItem(item);
          await this.tauriDb.removeFromSyncQueue(item.id);
          syncedCount++;
        } catch (error: any) {
          console.error(`❌ Failed to sync item ${item.id}:`, error);
          failedItems.push(item.id);

          // Update retry count
          await this.tauriDb.updateSyncQueueRetry(
            item.id,
            error.message || 'Unknown error'
          );
        }

        // Update progress
        const progress = Math.round((syncedCount / totalItems) * 100);
        this.syncProgressSubject.next(progress);
      }

      console.log(`✅ Sync completed: ${syncedCount}/${totalItems} succeeded`);

      if (failedItems.length > 0) {
        console.warn(`⚠️ ${failedItems.length} items failed to sync`);
      }

      // Update last sync time
      await this.tauriDb.setLastSyncTime();

    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncingSubject.next(false);
      this.syncProgressSubject.next(0);
    }
  }

  /**
   * Sync a single queue item to the API
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { operation_type, table_name, record_id, data } = item;

    console.log(`🔄 Syncing ${operation_type} on ${table_name} (${record_id})`);

    // Map table names to API endpoints
    const endpoint = this.getEndpointForTable(table_name, operation_type, record_id, data);

    if (!endpoint) {
      throw new Error(`No endpoint mapping for table: ${table_name}`);
    }

    // Execute the appropriate HTTP request
    switch (operation_type) {
      case 'create':
        await this.baseHttp.post(endpoint, data).toPromise();
        break;
      case 'update':
        await this.baseHttp.put(endpoint, data).toPromise();
        break;
      case 'delete':
        await this.baseHttp.delete(endpoint).toPromise();
        break;
    }
  }

  /**
   * Map table names to API endpoints
   */
  private getEndpointForTable(
    tableName: string,
    operationType: string,
    recordId: string,
    data: any
  ): string | null {
    // Map your table names to actual API endpoints
    switch (tableName) {
      case 'module_progress':
        if (operationType === 'create' && data.status === 'in_progress') {
          return `/api/student/modules/${data.module_id}/start`;
        } else if (operationType === 'create' && data.status === 'completed') {
          return `/api/student/modules/${data.module_id}/complete`;
        }
        return null;

      case 'quiz_attempts':
        if (operationType === 'create') {
          return `/api/student/quizzes/${data.quiz_id}/start`;
        } else if (operationType === 'update' && data.status === 'completed') {
          return `/api/student/attempts/${recordId}/complete`;
        }
        return null;

      case 'quiz_answers':
        if (operationType === 'create') {
          return `/api/student/attempts/${data.attempt_id}/answer`;
        }
        return null;

      case 'enrollments':
        if (operationType === 'create') {
          return `/api/student/enrollments/${data.course_id}`;
        } else if (operationType === 'delete') {
          return `/api/student/enrollments/${data.course_id}`;
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Get sync queue count
   */
  async getSyncQueueCount(): Promise<number> {
    return this.tauriDb.getSyncQueueCount();
  }

  /**
   * Clear sync queue (use with caution)
   */
  async clearSyncQueue(): Promise<void> {
    await this.tauriDb.clearSyncQueue();
    console.log('🗑️ Sync queue cleared');
  }
}
