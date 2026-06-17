import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus the cancel button on open (safe default)
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus()
    }
  }, [open])

  // Trap Escape key
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const iconColor = variant === 'danger' ? 'text-[var(--c-danger)]' : 'text-[var(--c-warning)]'
  const iconBg    = variant === 'danger' ? 'bg-[var(--c-danger-bg)] border-[var(--c-danger-border)]'
                                         : 'bg-[var(--c-warning-bg)] border-[var(--c-warning-border)]'

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        className={[
          'fixed left-1/2 top-1/2 z-[10001] -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md',
          'rounded-[var(--radius-xl)] border border-[var(--border-default)]',
          'bg-[var(--surface-2)] shadow-[var(--shadow-2xl)]',
          'p-6',
          'animate-spring-up',
        ].join(' ')}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full border ${iconBg}`}>
          <AlertTriangle className={`h-5 w-5 ${iconColor}`} />
        </div>

        {/* Text */}
        <h2 id="confirm-modal-title" className="text-lg font-bold text-[var(--text-1)] mb-2">
          {title}
        </h2>
        <p id="confirm-modal-desc" className="text-sm leading-relaxed text-[var(--text-2)]">
          {message}
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={variant === 'danger' ? 'danger' : 'secondary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  )
}
