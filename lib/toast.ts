// ─── TOAST EVENT BUS ─────────────────────────────────────────────────────────
// Simple event emitter for toasts — avoids prop-drilling.
// Components call toast.success(), toast.error() etc.
// ToastContainer subscribes to these events.

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;
type DismissListener = (id: string) => void;

let listeners: ToastListener[] = [];
let dismissListeners: DismissListener[] = [];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function emit(toast: ToastMessage) {
  listeners.forEach((l) => l(toast));
}

function emitDismiss(id: string) {
  dismissListeners.forEach((l) => l(id));
}

export const toast = {
  success(message: string, action?: ToastMessage['action']) {
    emit({ id: generateId(), type: 'success', message, action });
  },
  error(message: string, action?: ToastMessage['action']) {
    emit({ id: generateId(), type: 'error', message, action });
  },
  info(message: string, action?: ToastMessage['action']) {
    emit({ id: generateId(), type: 'info', message, action });
  },
  warning(message: string, action?: ToastMessage['action']) {
    emit({ id: generateId(), type: 'warning', message, action });
  },
  dismiss(id: string) {
    emitDismiss(id);
  },
  onToast(listener: ToastListener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
  onDismiss(listener: DismissListener) {
    dismissListeners.push(listener);
    return () => {
      dismissListeners = dismissListeners.filter((l) => l !== listener);
    };
  },
};
