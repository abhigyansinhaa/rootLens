import type { ReactNode } from 'react'
import { Card } from './Card'

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <Card padding="lg" tone="strong" className="border-dashed">
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
        {icon && (
          <div className="mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900/60 sm:mb-0">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-black tracking-tight text-[var(--text-1)]">{title}</h2>
          {description && <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{description}</p>}
          {action && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">{action}</div>
          )}
        </div>
      </div>
    </Card>
  )
}
