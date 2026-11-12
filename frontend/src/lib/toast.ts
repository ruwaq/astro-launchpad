export type ToastKind = 'success' | 'error' | 'info'

export type ToastOptions = {
  /** Secondary text, usually transaction details. */
  message?: string
  /** Hash of a Stellar transaction to link to explorer. */
  hash?: string
  /** 0 disables auto-dismiss. */
  durationMs?: number
}

export type Toast = {
  id: number
  kind: ToastKind
  title: string
  message?: string
  hash?: string
  durationMs: number
}

type ToastInput = ToastOptions & {
  kind?: ToastKind
  title: string
}

let nextId = 1
let toasts: Toast[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function pushToast(input: ToastInput): number {
  const toast: Toast = {
    id: nextId++,
    kind: input.kind ?? 'info',
    title: input.title,
    message: input.message,
    hash: input.hash,
    durationMs: input.durationMs ?? (input.kind === 'error' ? 8_000 : 6_000),
  }

  // At most 4 visible: avoids covering UI on mobile.
  toasts = [...toasts, toast].slice(-4)
  emit()

  if (toast.durationMs > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(toast.id), toast.durationMs)
  }

  return toast.id
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToastsSnapshot(): Toast[] {
  return toasts
}

/**
 * Notificaciones globales ligeras. No necesitamos un provider ni una librería:
 * el store vive fuera de React y se consume con `useSyncExternalStore`.
 */
export const toast = {
  success(title: string, options: ToastOptions = {}) {
    return pushToast({ kind: 'success', title, ...options })
  },
  error(title: string, options: ToastOptions = {}) {
    return pushToast({ kind: 'error', title, ...options })
  },
  info(title: string, options: ToastOptions = {}) {
    return pushToast({ kind: 'info', title, ...options })
  },
}
