import type { ReactNode } from 'react'

type Tone = 'default' | 'success' | 'warning' | 'risk' | 'info' | 'neutral' | 'purple' | 'cyan'

type StatusBadgeProps = {
  tone?:      Tone
  dot?:       boolean
  pulse?:     boolean
  children:   ReactNode
  className?: string
}

const toneMap: Record<Tone, { bg: string; border: string; text: string; dot: string }> = {
  default: {
    bg:     'bg-[var(--surface-3)]',
    border: 'border-[var(--border-default)]',
    text:   'text-[var(--text-2)]',
    dot:    'bg-[var(--text-3)]',
  },
  neutral: {
    bg:     'bg-[var(--surface-3)]',
    border: 'border-[var(--border-default)]',
    text:   'text-[var(--text-2)]',
    dot:    'bg-[var(--text-3)]',
  },
  success: {
    bg:     'bg-[var(--c-success-bg)]',
    border: 'border-[var(--c-success-border)]',
    text:   'text-[var(--c-success)]',
    dot:    'bg-[var(--c-success)]',
  },
  warning: {
    bg:     'bg-[var(--c-warning-bg)]',
    border: 'border-[var(--c-warning-border)]',
    text:   'text-[var(--c-warning)]',
    dot:    'bg-[var(--c-warning)]',
  },
  risk: {
    bg:     'bg-[var(--c-danger-bg)]',
    border: 'border-[var(--c-danger-border)]',
    text:   'text-[var(--c-danger)]',
    dot:    'bg-[var(--c-danger)]',
  },
  info: {
    bg:     'bg-[var(--c-info-bg)]',
    border: 'border-[var(--c-info-border)]',
    text:   'text-[var(--c-info)]',
    dot:    'bg-[var(--c-info)]',
  },
  purple: {
    bg:     'bg-[hsl(258_80%_58%/0.12)]',
    border: 'border-[hsl(258_80%_58%/0.3)]',
    text:   'text-[var(--color-purple-400)]',
    dot:    'bg-[var(--color-purple-400)]',
  },
  cyan: {
    bg:     'bg-[hsl(190_100%_55%/0.12)]',
    border: 'border-[hsl(190_100%_55%/0.3)]',
    text:   'text-[var(--chart-cyan)]',
    dot:    'bg-[var(--chart-cyan)]',
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
