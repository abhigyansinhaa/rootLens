import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type StatTone = 'default' | 'success' | 'warning' | 'risk' | 'info'

type StatProps = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: StatTone
  trend?: 'up' | 'down' | 'flat'
  trendValue?: string
  className?: string
}

const trendIconMap = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

const trendColorMap = {
  up: 'text-(--success)',
  down: 'text-(--critical)',
  flat: 'text-(--text-3)',
}

export function Stat({ label, value, hint, trend, trendValue, className = '' }: StatProps) {
  const TrendIcon = trend ? trendIconMap[trend] : null

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg border border-(--border-subtle)',
        'bg-(--surface-1)',
        'p-4 sm:p-5',
        className,
      ].join(' ')}
    >
      <p className="text-xs font-medium text-(--text-3)">{label}</p>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-(--text-1) tabular-nums leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      <div className="mt-2 flex items-center gap-2">
        {hint && <p className="text-xs text-(--text-2)">{hint}</p>}
        {TrendIcon && trendValue && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trendColorMap[trend!]}`}>
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </span>
        )}
      </div>
    </div>
  )
}
