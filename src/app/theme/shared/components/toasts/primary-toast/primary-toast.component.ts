import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Toast, ToastContainerConfig } from '../toasts.interfaces';
import { ToastAnimation, ToastPosition, ToastType } from '../toasts.enums';
import { ToastsService } from '../toasts.service';

@Component({
  selector: 'student-primary-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './primary-toast.component.html',
  styleUrls: ['./primary-toast.component.scss']
})
export class PrimaryToastComponent implements OnInit, OnDestroy {
  @Input() position: ToastPosition = ToastPosition.TopRight;
  @Input() maxToasts = 5;
  @Input() animation: ToastAnimation = ToastAnimation.SlideIn;
  @Input() pauseOnHover = true;

  @Output() toastDismiss = new EventEmitter<number>();

  toasts: Toast[] = [];
  containerConfig: ToastContainerConfig = {
    position: this.position,
    maxToasts: this.maxToasts,
    animation: this.animation,
    pauseOnHover: this.pauseOnHover
  };

  private subscriptions: Subscription[] = [];
  private pausedToasts = new Set<number>();

  constructor(private toastService: ToastsService) {}

  ngOnInit(): void {
    // Subscribe to active toasts
    this.subscriptions.push(
      this.toastService.activeToasts$.subscribe(toasts => {
        this.toasts = toasts;
      })
    );

    // Subscribe to container configuration
    this.subscriptions.push(
      this.toastService.containerConfig$.subscribe(config => {
        this.containerConfig = { ...this.containerConfig, ...config };
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ==================== COMPUTED PROPERTIES ====================

  get containerClasses(): string {
    const classes = [
      'toast-wrapper',
      `toast-position-${this.containerConfig.position}`,
      `toast-animation-${this.containerConfig.animation}`
    ];

    return classes.join(' ');
  }

  get displayedToasts(): Toast[] {
    return this.toasts.slice(0, this.containerConfig.maxToasts);
  }

  // ==================== EVENT HANDLERS ====================

  onToastHover(toast: Toast, isHovered: boolean): void {
    if (!this.containerConfig.pauseOnHover) return;

    if (isHovered) {
      this.pausedToasts.add(toast.id);
    } else {
      this.pausedToasts.delete(toast.id);
    }
  }

  onActionClick(toast: Toast): void {
    if (toast.actionButton?.action) {
      toast.actionButton.action();

      // Remove toast after action unless it's persistent
      if (!toast.persistent) {
        this.removeToast(toast.id);
      }
    }
  }

  removeToast(id: number): void {
    this.toastService.dismiss(id);
    this.toastDismiss.emit(id);
  }

  // ==================== UTILITY METHODS ====================

  trackToast(index: number, toast: Toast): number {
    return toast.id;
  }

  getToastClasses(toast: Toast): string {
    const classes = [
      'toast-item',
      `toast-${toast.type}`
    ];

    if (toast.persistent) {
      classes.push('toast-persistent');
    }

    if (toast.actionButton) {
      classes.push('toast-has-action');
    }

    if (toast.title) {
      classes.push('toast-has-title');
    }

    if (this.pausedToasts.has(toast.id)) {
      classes.push('toast-paused');
    }

    return classes.join(' ');
  }

  getAriaRole(toast: Toast): string {
    switch (toast.type) {
      case ToastType.Error:
      case ToastType.Warning:
        return 'alert';
      case ToastType.Success:
      case ToastType.Info:
      default:
        return 'status';
    }
  }

  getAriaLive(toast: Toast): string {
    switch (toast.type) {
      case ToastType.Error:
      case ToastType.Warning:
        return 'assertive';
      default:
        return 'polite';
    }
  }

  shouldShowProgress(toast: Toast): boolean {
    return !toast.persistent && !!toast.duration && toast.duration > 0;
  }
}
