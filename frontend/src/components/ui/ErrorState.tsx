import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'

type ErrorStateProps = {
  title?:      string
  message?:    string
  onRetry?:    () => void
  retryLabel?: string
}

export function ErrorState({
  title      = 'Something went wrong',
  message    = 'An unexpected error occurred.',
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] px-8 py-12 text-center animate-spring-in">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--c-danger-bg)] border border-[var(--c-danger-border)]">
        <AlertTriangle className="h-7 w-7 text-[var(--c-danger)]" />
      </div>
      <h3 className="text-base font-bold text-[var(--text-1)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-2)]">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-6"
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
