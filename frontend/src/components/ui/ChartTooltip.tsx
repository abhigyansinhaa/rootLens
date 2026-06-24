import type { ReactNode } from 'react'

type ChartTooltipProps = {
  title?: string
  value?: ReactNode
  context?: string
  active?: boolean
}

export function ChartTooltip({ title, value, context, active }: ChartTooltipProps) {
  if (!active) return null
  return (
    <div
      className="rounded-lg bg-(--surface-2)/95 px-3 py-2 shadow-(--shadow-overlay) backdrop-blur-md"
      style={{ fontSize: 12 }}
    >
      {title && <p className="font-semibold text-(--text-1) mb-0.5">{title}</p>}
      {value != null && (
        <p className="font-mono text-sm font-medium tabular-nums text-(--text-1)">{value}</p>
      )}
      {context && <p className="text-xs text-(--text-3) mt-1">{context}</p>}
    </div>
  )
}

