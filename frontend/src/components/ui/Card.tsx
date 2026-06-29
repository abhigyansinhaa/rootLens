import type { ReactNode } from 'react'

type CardTone = 'default' | 'strong' | 'risk' | 'success' | 'warning' | 'info'
type CardVariant = 'default' | 'solid' | 'flat'
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
  default: 'bg-(--surface-1)',
  strong:  'bg-(--surface-2)',
  risk:    'bg-(--critical-bg)',
  success: 'bg-(--success-bg)',
  warning: 'bg-(--warning-bg)',
  info:    'bg-(--info-bg)',
}

const variantStyles: Record<CardVariant, string> = {
  default: 'border border-(--border-subtle)',
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
    ? 'shadow-md'
    : ''

  const hoverCls = hover
    ? 'transition-colors duration-(--duration-normal) hover:border-(--border-strong) hover:bg-(--surface-2)'
    : ''

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg',
        toneStyles[tone],
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

      {children}
    </div>
  )
}

export function CardEyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-medium text-(--text-3) ${className}`}>
      {children}
    </p>
  )
}
