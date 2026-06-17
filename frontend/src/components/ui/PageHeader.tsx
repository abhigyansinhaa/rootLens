import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?:   string
  title:      string
  description?: string
  meta?:      ReactNode
  actions?:   ReactNode
  gradient?:  boolean
}

export function PageHeader({ eyebrow, title, description, meta, actions, gradient = false }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between animate-fade-in-up">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
            {eyebrow}
          </p>
        )}
        <h1
          className={[
            'text-2xl sm:text-3xl font-bold tracking-tight leading-tight',
            gradient
              ? 'text-gradient-brand'
              : 'text-[var(--text-1)]',
          ].join(' ')}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-2)]">
            {description}
          </p>
        )}
        {meta && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {meta}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
