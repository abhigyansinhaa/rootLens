type LoadingStateProps = {
  rows?:    number
  message?: string
  fullPage?: boolean
}

function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 space-y-3 overflow-hidden">
      <div className={`skeleton h-3 rounded-full ${wide ? 'w-1/2' : 'w-1/3'}`} />
      <div className="skeleton h-8 w-3/4 rounded-[var(--radius-md)]" />
      <div className="skeleton h-3 w-full rounded-full" />
      <div className="skeleton h-3 w-4/5 rounded-full opacity-60" />
    </div>
  )
}

export function LoadingState({ rows = 3, message, fullPage = false }: LoadingStateProps) {
  if (fullPage) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        {/* Orbital spinner */}
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--brand)] animate-spin" />
          <div
            className="absolute inset-2 rounded-full border border-transparent border-t-[var(--brand)] opacity-40 animate-spin"
            style={{ animationDuration: '0.7s' }}
          />
        </div>
        {message && (
          <p className="text-sm font-medium text-[var(--text-3)] animate-pulse">
            {message}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in" role="status" aria-label={message ?? 'Loading…'}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <SkeletonCard key={i} wide={i % 2 === 0} />
        ))}
      </div>
      {rows > 4 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: Math.min(rows - 4, 2) }).map((_, i) => (
            <SkeletonCard key={i} wide />
          ))}
        </div>
      )}
      {message && (
        <p className="text-center text-xs text-[var(--text-3)] animate-pulse pt-2">{message}</p>
      )}
    </div>
  )
}
