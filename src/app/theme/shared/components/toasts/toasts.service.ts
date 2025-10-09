import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import {
  Toast,
  ToastConfig,
  ToastContainerConfig,
  ToastQueueConfig
} from './toasts.interfaces';
import {
  ToastType,
  ToastPosition,
  ToastAnimation
} from './toasts.enums';

@Injectable({
  providedIn: 'root'
})
export class ToastsService {
  // Core observables
  private _toasts = new Subject<Toast>();
  public toasts$ = this._toasts.asObservable();

  private _activeToasts = new BehaviorSubject<Toast[]>([]);
  public activeToasts$ = this._activeToasts.asObservable();

  // Configuration
  private containerConfigSubject = new BehaviorSubject<ToastContainerConfig>(this.getDefaultContainerConfig());
  public containerConfig$ = this.containerConfigSubject.asObservable();

  // Internal state
  private counter = 0;
  private activeToasts: Toast[] = [];
  private toastTimers = new Map<number, number>();
  private queueConfig: ToastQueueConfig = {
    maxSize: 5,
    strategy: 'fifo'
  };

  // ==================== PUBLIC METHODS ====================

  /**
   * Show success toast
   */
  success(message: string, duration = 3000): number {
    return this.show({
      message,
      type: ToastType.Success,
      duration
    });
  }

  /**
   * Show error toast
   */
  error(message: string, duration = 3000): number {
    return this.show({
      message,
      type: ToastType.Error,
      duration
    });
  }

  /**
   * Show warning toast
   */
  warning(message: string, duration = 3000): number {
    return this.show({
      message,
      type: ToastType.Warning,
      duration
    });
  }

  /**
   * Show info toast
   */
  info(message: string, duration = 3000): number {
    return this.show({
      message,
      type: ToastType.Info,
      duration
    });
  }

  /**
   * Show toast with full configuration
   */
  showToastAdvanced(config: ToastConfig): number {
    return this.show({
      message: config.message,
      type: config.type,
      title: config.title,
      duration: config.duration,
      icon: config.icon,
      closable: config.closable !== false,
      persistent: config.persistent || false,
      actionButton: config.actionButton
    });
  }

  /**
   * Dismiss specific toast
   */
  dismiss(toastId: number): void {
    this.removeToast(toastId);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.activeToasts.forEach(toast => {
      this.removeToast(toast.id);
    });
  }

  /**
   * Update container configuration
   */
  updateContainerConfig(config: Partial<ToastContainerConfig>): void {
    const currentConfig = this.containerConfigSubject.value;
    this.containerConfigSubject.next({ ...currentConfig, ...config });
  }

  /**
   * Update queue configuration
   */
  updateQueueConfig(config: Partial<ToastQueueConfig>): void {
    this.queueConfig = { ...this.queueConfig, ...config };
  }

  // ==================== INTERNAL METHODS ====================

  private show(config: Partial<Toast>): number {
    const id = this.counter++;

    const toast: Toast = {
      id,
      message: config.message || '',
      type: config.type || ToastType.Info,
      title: config.title,
      duration: config.duration,
      icon: config.icon || this.getDefaultIcon(config.type || ToastType.Info),
      closable: config.closable !== false,
      persistent: config.persistent || false,
      actionButton: config.actionButton,
      timestamp: new Date()
    };

    // Queue management - remove oldest if at max capacity
    if (this.activeToasts.length >= this.queueConfig.maxSize) {
      if (this.queueConfig.strategy === 'fifo') {
        const oldestToast = this.activeToasts[0];
        this.removeToast(oldestToast.id);
      } else {
        const newestToast = this.activeToasts[this.activeToasts.length - 1];
        this.removeToast(newestToast.id);
      }
    }

    // Add to active toasts
    this.activeToasts.push(toast);
    this._activeToasts.next([...this.activeToasts]);

    // Emit the toast
    this._toasts.next(toast);

    // Set up auto-dismiss timer
    if (!toast.persistent && toast.duration && toast.duration > 0) {
      const timer = window.setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);

      this.toastTimers.set(id, timer);
    }

    return id;
  }

  private removeToast(id: number): void {
    const toastIndex = this.activeToasts.findIndex(toast => toast.id === id);
    if (toastIndex === -1) return;

    // Clear timer
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }

    // Remove from active toasts
    this.activeToasts.splice(toastIndex, 1);
    this._activeToasts.next([...this.activeToasts]);
  }

  private getDefaultIcon(type: ToastType): string {
    switch (type) {
      case ToastType.Success: return 'fas fa-check-circle';
      case ToastType.Error: return 'fas fa-exclamation-circle';
      case ToastType.Warning: return 'fas fa-exclamation-triangle';
      case ToastType.Info: return 'fas fa-info-circle';
      default: return 'fas fa-info-circle';
    }
  }

  private getDefaultContainerConfig(): ToastContainerConfig {
    return {
      position: ToastPosition.TopRight,
      maxToasts: 5,
      animation: ToastAnimation.SlideIn,
      pauseOnHover: true
    };
  }

  // ==================== CLEANUP ====================

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.dismissAll();
    this._toasts.complete();
    this._activeToasts.complete();
    this.containerConfigSubject.complete();
  }
}
