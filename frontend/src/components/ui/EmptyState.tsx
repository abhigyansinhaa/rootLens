import type { ReactNode } from 'react'
import { PackageOpen } from 'lucide-react'

type EmptyStateProps = {
  title:        string
  description?: string
  icon?:        ReactNode
  action?:      ReactNode
  className?:   string
}

export function EmptyState({ title, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={[
        'relative flex flex-col items-center justify-center',
        'rounded-xl border border-dashed border-(--border-default)',
        'bg-(--surface-1) px-8 py-16 text-center',
        'animate-fade-in',
        className,
      ].join(' ')}
    >
      {/* Icon */}
      <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-(--border-default) bg-(--surface-2) text-(--text-3)">
        {icon ?? <PackageOpen className="h-7 w-7" />}
      </div>

      <h3 className="relative z-10 text-lg font-bold text-(--text-1)">{title}</h3>

      {description && (
        <p className="relative z-10 mt-2 max-w-sm text-sm leading-relaxed text-(--text-2)">
          {description}
        </p>
      )}

      {action && (
        <div className="relative z-10 mt-6">{action}</div>
      )}
    </div>
  )
}
