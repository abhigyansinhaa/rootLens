import type { ReactNode } from 'react'

type Tone = 'default' | 'risk' | 'warning' | 'success' | 'info'

type Props = {
  label: string
  value: ReactNode
  hint?: ReactNode
  delta?: ReactNode
  tone?: Tone
  className?: string
}

const toneRing: Record<Tone, string> = {
  default: 'ring-[var(--border-1)]',
  info: 'ring-brand-300/60 dark:ring-brand-800/70',
  success: 'ring-emerald-300/60 dark:ring-emerald-800/60',
  warning: 'ring-amber-300/60 dark:ring-amber-800/60',
  risk: 'ring-red-300/60 dark:ring-red-800/60',
}

const toneAccent: Record<Tone, string> = {
  default: 'before:bg-[var(--border-2)]',
  info: 'before:bg-brand-500',
  success: 'before:bg-emerald-500',
  warning: 'before:bg-amber-500',
  risk: 'before:bg-red-500',
}

export function Stat({ label, value, hint, delta, tone = 'default', className = '' }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-5 ring-1 ${toneRing[tone]} before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${toneAccent[tone]} ${className}`.trim()}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-3)]">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight tabular-nums text-[var(--text-1)]">{value}</p>
      {(hint || delta) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          {hint && <span className="text-[var(--text-2)]">{hint}</span>}
          {delta && <span className="font-semibold tabular-nums">{delta}</span>}
        </div>
      )}
    </div>
  )
}
