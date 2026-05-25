import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  elevated?: boolean
  tone?: 'default' | 'strong' | 'risk' | 'warning' | 'success' | 'info' | 'flat'
  radius?: 'md' | 'lg' | 'xl'
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
  xl: 'p-8 sm:p-10',
}

const radiusMap = {
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
}

export function Card({
  children,
  className = '',
  padding = 'md',
  elevated = false,
  tone = 'default',
  radius = 'lg',
  ...rest
}: Props) {
  const shadow = elevated ? 'shadow-md hover:shadow-lg transition-shadow duration-300' : 'shadow-sm'
  const tones: Record<NonNullable<Props['tone']>, string> = {
    default:
      'border-[var(--border-subtle)] bg-[var(--surface-1)] backdrop-blur-xl glass',
    strong:
      'border-[var(--border-subtle)] bg-[var(--surface-2)]/90 backdrop-blur-xl',
    flat:
      'border-[var(--border-subtle)] bg-[var(--surface-1)]',
    risk:
      'border-red-200/50 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20 backdrop-blur-md',
    warning:
      'border-amber-200/50 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 backdrop-blur-md',
    success:
      'border-emerald-200/50 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20 backdrop-blur-md',
    info:
      'border-brand-200/50 bg-brand-50/50 dark:border-brand-900/30 dark:bg-brand-950/20 backdrop-blur-md',
  }
  return (
    <div
      className={`${radiusMap[radius]} border ${tones[tone]} ${shadow} ${paddingMap[padding]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-base font-bold tracking-tight text-[var(--text-1)] ${className}`.trim()}>
      {children}
    </h3>
  )
}

export function CardDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mt-1.5 text-sm leading-relaxed text-[var(--text-2)] ${className}`.trim()}>{children}</p>
  )
}

export function CardEyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-2 ${className}`.trim()}
    >
      {children}
    </p>
  )
}
