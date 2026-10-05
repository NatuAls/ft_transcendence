import { createContext } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';
export interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}
export interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

export interface ToastContextValue {
  show: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  show: () => {},
  dismiss: () => {},
});
