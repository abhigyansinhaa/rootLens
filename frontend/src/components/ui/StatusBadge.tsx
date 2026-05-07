import type { ReactNode } from 'react'

type Tone = 'default' | 'info' | 'success' | 'warning' | 'risk' | 'neutral'

type Props = {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}

const tones: Record<Tone, { wrap: string; dot: string }> = {
  default: {
    wrap:
      'bg-[var(--surface-3)] text-[var(--text-2)] ring-[var(--border-1)]',
    dot: 'bg-[var(--text-3)]',
  },
  neutral: {
    wrap:
      'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700',
    dot: 'bg-slate-400 dark:bg-slate-500',
  },
  info: {
    wrap:
      'bg-brand-50/80 text-brand-800 ring-brand-200/80 dark:bg-brand-950/60 dark:text-brand-200 dark:ring-brand-800/70',
    dot: 'bg-brand-500',
  },
  success: {
    wrap:
      'bg-emerald-50/80 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  warning: {
    wrap:
      'bg-amber-50/80 text-amber-900 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-800/60',
    dot: 'bg-amber-500',
  },
  risk: {
    wrap:
      'bg-red-50/80 text-red-900 ring-red-200/80 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800/60',
    dot: 'bg-red-500',
  },
}

export function StatusBadge({ children, tone = 'default', dot = false, className = '' }: Props) {
  const t = tones[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${t.wrap} ${className}`.trim()}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />}
      {children}
    </span>
  )
}
