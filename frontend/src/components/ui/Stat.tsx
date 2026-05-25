import type { ReactNode } from 'react'

type Tone = 'default' | 'risk' | 'warning' | 'success' | 'info'

type Props = {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  delta?: ReactNode
  tone?: Tone
  className?: string
}

const toneBg: Record<Tone, string> = {
  default: 'bg-[var(--surface-1)]',
  info: 'bg-brand-500/5',
  success: 'bg-emerald-500/5',
  warning: 'bg-amber-500/5',
  risk: 'bg-red-500/5',
}

const toneRing: Record<Tone, string> = {
  default: 'ring-1 ring-[var(--border-subtle)]',
  info: 'ring-2 ring-brand-500/40',
  success: 'ring-2 ring-emerald-500/40',
  warning: 'ring-2 ring-amber-500/40',
  risk: 'ring-2 ring-red-500/40',
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
      className={`relative overflow-hidden rounded-2xl glass backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md ${toneBg[tone]} ${toneRing[tone]} before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 ${toneAccent[tone]} ${className}`.trim()}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-[var(--text-3)] mb-3">
        {label}
      </p>
      <p className="text-3xl font-black leading-none tracking-tight tabular-nums text-[var(--text-1)]">
        {value}
      </p>
      {(hint || delta) && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-1.5 text-xs">
          {hint && <div className="text-[var(--text-2)]">{hint}</div>}
          {delta && <div className="font-bold tabular-nums text-[var(--text-1)]">{delta}</div>}
        </div>
      )}
    </div>
  )
}
