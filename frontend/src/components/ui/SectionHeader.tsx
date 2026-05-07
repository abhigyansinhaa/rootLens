import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}

export function SectionHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-600 dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-lg font-black tracking-tight text-[var(--text-1)] sm:text-xl">
          {title}
        </h2>
        {description && (
          <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-2)]">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
