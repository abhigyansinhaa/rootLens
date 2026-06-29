import type { ReactNode } from 'react'

type Tone = 'default' | 'success' | 'warning' | 'risk' | 'info' | 'neutral'

type StatusBadgeProps = {
  tone?: Tone
  dot?: boolean
  pulse?: boolean
  children: ReactNode
  className?: string
}

const toneMap: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
  default: {
    bg: 'bg-(--surface-3)',
    border: 'border-(--border-default)',
    text: 'text-(--text-2)',
    dot: 'bg-(--text-3)',
  },
  neutral: {
    bg: 'bg-(--surface-3)',
    border: 'border-(--border-default)',
    text: 'text-(--text-2)',
    dot: 'bg-(--text-3)',
  },
  success: {
    bg: 'bg-(--success-bg)',
    border: 'border-(--success-border)',
    text: 'text-(--success)',
    dot: 'bg-(--success)',
  },
  warning: {
    bg: 'bg-(--warning-bg)',
    border: 'border-(--warning-border)',
    text: 'text-(--warning)',
    dot: 'bg-(--warning)',
  },
  risk: {
    bg: 'bg-(--critical-bg)',
    border: 'border-(--critical-border)',
    text: 'text-(--critical)',
    dot: 'bg-(--critical)',
  },
  info: {
    bg: 'bg-(--info-bg)',
    border: 'border-(--info-border)',
    text: 'text-(--info)',
    dot: 'bg-(--info)',
  },
}

export function StatusBadge({ tone = 'default', dot, pulse, children, className = '' }: StatusBadgeProps) {
  const t = toneMap[tone]

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-full border px-2.5 py-0.5',
        'text-[11px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap',
        t.bg, t.border, t.text,
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          aria-hidden
          className={[
            'h-1.5 w-1.5 rounded-full shrink-0',
            t.dot,
            pulse ? 'animate-[dotPulse_2s_ease-in-out_infinite]' : '',
          ].join(' ')}
        />
      )}
      {children}
    </span>
  )
}
