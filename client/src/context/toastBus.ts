export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastPayload {
  title: string;
  message?: string;
  type: ToastType;
}

type ToastListener = (toast: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitToast(toast: ToastPayload) {
  listeners.forEach((listener) => listener(toast));
}

export function emitErrorToast(message: string, title = 'Something went wrong') {
  emitToast({ type: 'error', title, message });
}

export function emitSuccessToast(message: string, title = 'Success') {
  emitToast({ type: 'success', title, message });
}

export function emitInfoToast(message: string, title = 'Reminder') {
  emitToast({ type: 'info', title, message });
}

export function emitWarningToast(message: string, title = 'Warning') {
  emitToast({ type: 'warning', title, message });
}
