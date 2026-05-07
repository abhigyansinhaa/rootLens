import { Card } from './Card'

type Props = {
  message?: string
  rows?: number
}

export function LoadingState({ message = 'Loading…', rows = 3 }: Props) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={message}>
      <p className="sr-only">{message}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} padding="md" tone="strong" className="animate-pulse">
          <div className="h-3 w-1/4 rounded-full bg-[var(--border-1)]" />
          <div className="mt-4 h-2 w-3/4 rounded bg-[var(--border-1)]" />
          <div className="mt-2 h-2 w-2/4 rounded bg-[var(--border-1)]" />
        </Card>
      ))}
    </div>
  )
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-[var(--border-1)] border-t-brand-500 ${className}`}
      role="presentation"
    />
  )
}
