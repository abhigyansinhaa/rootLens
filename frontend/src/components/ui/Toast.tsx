import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────────────── */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  title?: string
  variant: ToastVariant
  duration?: number  // ms, 0 = persistent
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
  /** Convenience shorthands */
  success: (message: string, title?: string) => string
  error:   (message: string, title?: string) => string
  warning: (message: string, title?: string) => string
  info:    (message: string, title?: string) => string
}

/* ─────────────────────────────────────────────────────────────────────────────
   Context
   ───────────────────────────────────────────────────────────────────────────── */
const ToastCtx = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

/* ─────────────────────────────────────────────────────────────────────────────
   Individual Toast Item
   ───────────────────────────────────────────────────────────────────────────── */
const VARIANT_STYLES: Record<ToastVariant, {
  bar: string
  icon: typeof CheckCircle2
  iconColor: string
  bg: string
  border: string
}> = {
  success: {
    bar: 'bg-[var(--c-success)]',
    icon: CheckCircle2,
    iconColor: 'text-[var(--c-success)]',
    bg: 'bg-[var(--surface-2)]',
    border: 'border-[var(--c-success-border)]',
  },
  error: {
    bar: 'bg-[var(--c-danger)]',
    icon: XCircle,
    iconColor: 'text-[var(--c-danger)]',
    bg: 'bg-[var(--surface-2)]',
    border: 'border-[var(--c-danger-border)]',
  },
  warning: {
    bar: 'bg-[var(--c-warning)]',
    icon: AlertTriangle,
    iconColor: 'text-[var(--c-warning)]',
    bg: 'bg-[var(--surface-2)]',
    border: 'border-[var(--c-warning-border)]',
  },
  info: {
    bar: 'bg-[var(--c-info)]',
    icon: Info,
    iconColor: 'text-[var(--c-info)]',
    bg: 'bg-[var(--surface-2)]',
    border: 'border-[var(--c-info-border)]',
  },
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const duration = toast.duration ?? 4500

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 320)
  }, [onDismiss, toast.id])

  useEffect(() => {
    if (duration === 0) return
    timerRef.current = setTimeout(dismiss, duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [dismiss, duration])

  const v = VARIANT_STYLES[toast.variant]
  const Icon = v.icon

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateX(110%)' : 'translateX(0)',
      }}
      className={[
        'relative flex items-start gap-3 overflow-hidden',
        'w-[360px] max-w-[calc(100vw-2rem)]',
        'rounded-[var(--radius-lg)] border',
        'p-4 shadow-[var(--shadow-lg)]',
        'backdrop-blur-xl',
        v.bg, v.border,
      ].join(' ')}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[var(--radius-lg)] ${v.bar}`} />

      {/* Icon */}
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${v.iconColor}`} />

      {/* Content */}
      <div className="flex-1 min-w-0 pl-1">
        {toast.title && (
          <p className="text-sm font-bold text-[var(--text-1)] leading-tight mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-sm text-[var(--text-2)] leading-snug">{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={dismiss}
        className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 h-[2px] ${v.bar} opacity-40`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Provider + Toaster portal
   ───────────────────────────────────────────────────────────────────────────── */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev.slice(-4), { ...opts, id }]) // max 5 at once
    return id
  }, [])

  const success = useCallback((message: string, title?: string) =>
    toast({ variant: 'success', message, title }), [toast])
  const error   = useCallback((message: string, title?: string) =>
    toast({ variant: 'error',   message, title, duration: 7000 }), [toast])
  const warning = useCallback((message: string, title?: string) =>
    toast({ variant: 'warning', message, title }), [toast])
  const info    = useCallback((message: string, title?: string) =>
    toast({ variant: 'info',    message, title }), [toast])

  return (
    <ToastCtx.Provider value={{ toast, dismiss, success, error, warning, info }}>
      {children}
      {createPortal(
        <div
          aria-label="Notifications"
          className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 pointer-events-none"
        >
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
