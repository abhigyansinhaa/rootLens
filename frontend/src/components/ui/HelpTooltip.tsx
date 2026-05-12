import type { ReactNode } from 'react'

/** Accessible “?” hint; uses native tooltip for simplicity. */
export function HelpTooltip({ children, title }: { children: ReactNode; title: string }) {
  return (
    <abbr className="cursor-help underline decoration-dotted decoration-[var(--text-3)]" title={title}>
      {children}
    </abbr>
  )
}
