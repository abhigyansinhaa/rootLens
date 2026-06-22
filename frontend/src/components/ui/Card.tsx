import type { ReactNode } from 'react'

type CardTone = 'default' | 'strong' | 'risk' | 'success' | 'warning' | 'info'
type CardVariant = 'default' | 'glass' | 'solid' | 'flat'
type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

type CardProps = {
  children: ReactNode
  tone?:       CardTone
  variant?:    CardVariant
  padding?:    CardPadding
  elevated?:   boolean
  hover?:      boolean
  accentColor?: string
  accentTop?:  boolean
  className?:  string
}

const toneStyles: Record<CardTone, string> = {
  default: 'bg-(--surface-1) border-(--border-subtle)',
  strong:  'bg-(--surface-2) border-(--border-default)',
  risk:    'bg-(--c-danger-bg) border-(--c-danger-border)',
  success: 'bg-(--c-success-bg) border-(--c-success-border)',
  warning: 'bg-(--c-warning-bg) border-(--c-warning-border)',
  info:    'bg-(--c-info-bg) border-(--c-info-border)',
}

const variantStyles: Record<CardVariant, string> = {
  default: 'border',
  glass:   'border backdrop-blur-[20px]',
  solid:   'border-0',
  flat:    'border-0 bg-transparent',
}

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5 sm:p-6',
  xl:   'p-6 sm:p-8',
}

export function Card({
  children,
  tone     = 'default',
  variant  = 'default',
  padding  = 'md',
  elevated = false,
  hover    = false,
  accentColor,
  accentTop = true,
  className = '',
}: CardProps) {
  const elevShadow = elevated
    ? 'shadow-(--shadow-md)'
    : ''

  const hoverCls = hover
    ? 'transition-all duration-(--duration-normal) hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg),0_0_30px_hsl(214_100%_59%/0.08)] hover:border-(--border-brand)'
    : ''

  const glassBase = variant === 'glass'
    ? 'bg-(--glass-1) backdrop-blur-[20px]'
    : ''

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg',
        variant !== 'glass' ? toneStyles[tone] : `border ${toneStyles[tone].split(' ').find(c => c.startsWith('border-[')) ?? ''}`,
        variant === 'glass' ? glassBase : '',
        variantStyles[variant],
        paddingStyles[padding],
        elevShadow,
        hoverCls,
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* Top accent stripe */}
      {accentColor && accentTop && (
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: accentColor }}
        />
      )}

      {/* Ambient glow layer for elevated glass cards */}
      {elevated && variant === 'glass' && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 70%)' }}
        />
      )}

      {children}
    </div>
  )
}

export function CardEyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-(--text-3) ${className}`}>
      {children}
    </p>
  )
}
