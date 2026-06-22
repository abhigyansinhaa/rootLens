import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type StatTone = 'default' | 'success' | 'warning' | 'risk' | 'info'

type StatProps = {
  label:       ReactNode
  value:       ReactNode
  hint?:       ReactNode
  tone?:       StatTone
  trend?:      'up' | 'down' | 'flat'
  trendValue?: string
  numeric?:    boolean
  className?:  string
}

const toneAccent: Record<StatTone, string> = {
  default: 'bg-(--brand)',
  success: 'bg-(--c-success)',
  warning: 'bg-(--c-warning)',
  risk:    'bg-(--c-danger)',
  info:    'bg-(--c-info)',
}

const trendIconMap = {
  up:   TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

const trendColorMap = {
  up:   'text-(--c-success)',
  down: 'text-(--c-danger)',
  flat: 'text-(--text-3)',
}

/** Rolls numbers from 0 → target on mount. Strings skip animation. */
function AnimatedValue({ value }: { value: ReactNode }) {
  const [display, setDisplay] = useState<ReactNode>('')
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof value !== 'number') { setDisplay(value); return }
    const end = value
    const duration = 900
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * end).toLocaleString())
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return <span>{display}</span>
}

export function Stat({ label, value, hint, tone = 'default', trend, trendValue, className = '' }: StatProps) {
  const TrendIcon = trend ? trendIconMap[trend] : null

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg',
        'border border-(--border-subtle) bg-(--surface-1)',
        'p-5 transition-all duration-(--duration-normal)',
        'hover:border-(--border-default) hover:bg-(--surface-2)',
        className,
      ].join(' ')}
    >
      {/* Tone accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full ${toneAccent[tone]}`} />

      <p className="pl-3 text-[11px] font-bold uppercase tracking-[0.12em] text-(--text-3)">
        {label}
      </p>

      <p className="pl-3 mt-2 text-3xl font-bold tracking-tight text-(--text-1) font-mono tabular-nums leading-none">
        <AnimatedValue value={value} />
      </p>

      <div className="pl-3 mt-2 flex items-center gap-2">
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
