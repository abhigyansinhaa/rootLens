import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: string
  meta?: ReactNode
}

export function PageHeader({ title, description, actions, eyebrow, meta }: Props) {
  return (
    <div className="flex flex-col gap-5 border-b border-[var(--border-1)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-600 dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h1
          className={`text-3xl font-black tracking-tight text-[var(--text-1)] sm:text-4xl ${
            eyebrow ? 'mt-3' : ''
          }`}
        >
          {title}
        </h1>
        {description != null && description !== '' && (
          <div className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-2)]">{description}</div>
        )}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
