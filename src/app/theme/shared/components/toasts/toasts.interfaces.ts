import {
  ToastType,
  ToastPosition,
  ToastAnimation
} from './toasts.enums';

// Main toast interface
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
  icon?: string;
  closable?: boolean;
  persistent?: boolean;
  actionButton?: ToastActionButton;
  timestamp?: Date;
}

// Toast configuration for showToastAdvanced
export interface ToastConfig {
  message: string;
  type: ToastType;
  title?: string;
  duration?: number;
  icon?: string;
  closable?: boolean;
  persistent?: boolean;
  actionButton?: ToastActionButton;
}

// Action button configuration
export interface ToastActionButton {
  text: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  loading?: boolean;
}

// Toast container configuration
export interface ToastContainerConfig {
  position: ToastPosition;
  maxToasts: number;
  animation: ToastAnimation;
  pauseOnHover: boolean;
}

// Toast queue configuration
export interface ToastQueueConfig {
  maxSize: number;
  strategy: 'fifo' | 'lifo';
}
