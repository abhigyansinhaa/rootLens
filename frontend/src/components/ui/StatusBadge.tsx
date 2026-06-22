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
    bg:     'bg-(--surface-3)',
    border: 'border-(--border-default)',
    text:   'text-(--text-2)',
    dot:    'bg-(--text-3)',
  },
  neutral: {
    bg:     'bg-(--surface-3)',
    border: 'border-(--border-default)',
    text:   'text-(--text-2)',
    dot:    'bg-(--text-3)',
  },
  success: {
    bg:     'bg-(--c-success-bg)',
    border: 'border-(--c-success-border)',
    text:   'text-(--c-success)',
    dot:    'bg-(--c-success)',
  },
  warning: {
    bg:     'bg-(--c-warning-bg)',
    border: 'border-(--c-warning-border)',
    text:   'text-(--c-warning)',
    dot:    'bg-(--c-warning)',
  },
  risk: {
    bg:     'bg-(--c-danger-bg)',
    border: 'border-(--c-danger-border)',
    text:   'text-(--c-danger)',
    dot:    'bg-(--c-danger)',
  },
  info: {
    bg:     'bg-(--c-info-bg)',
    border: 'border-(--c-info-border)',
    text:   'text-(--c-info)',
    dot:    'bg-(--c-info)',
  },
  purple: {
    bg:     'bg-[hsl(258_80%_58%/0.12)]',
    border: 'border-[hsl(258_80%_58%/0.3)]',
    text:   'text-purple-400',
    dot:    'bg-(--color-purple-400)',
  },
  cyan: {
    bg:     'bg-[hsl(190_100%_55%/0.12)]',
    border: 'border-[hsl(190_100%_55%/0.3)]',
    text:   'text-(--chart-cyan)',
    dot:    'bg-(--chart-cyan)',
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
