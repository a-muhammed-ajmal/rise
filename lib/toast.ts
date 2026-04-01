type ToastHandler = (message: string, type?: 'success' | 'error') => void;

let _handler: ToastHandler | null = null;

export function _registerToastHandler(fn: ToastHandler) {
  _handler = fn;
}

export function toast(message: string, type: 'success' | 'error' = 'success') {
  _handler?.(message, type);
}
