import type { ReactNode } from 'react'

type SectionHeaderProps = {
  eyebrow?:     string
  title:        string
  description?: string
  actions?:     ReactNode
  className?:   string
}

export function SectionHeader({ eyebrow, title, description, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium text-(--brand)">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-bold tracking-tight text-(--text-1)">{title}</h2>
        {description && (
          <p className="mt-1 max-w-xl text-sm text-(--text-2)">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
