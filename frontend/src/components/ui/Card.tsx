import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  elevated?: boolean
  tone?: 'default' | 'strong' | 'risk' | 'warning' | 'success' | 'info' | 'flat'
  radius?: 'md' | 'lg' | 'xl'
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
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
  const shadow = elevated ? 'shadow-[var(--shadow-elevated)]' : 'shadow-[var(--shadow-soft)]'
  const tones: Record<NonNullable<Props['tone']>, string> = {
    default:
      'border-[var(--border-1)] bg-[var(--surface-1)] backdrop-blur-xl',
    strong:
      'border-[var(--border-1)] bg-[var(--surface-2)] backdrop-blur-xl',
    flat:
      'border-[var(--border-1)] bg-[var(--surface-3)]',
    risk:
      'border-red-200/70 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30',
    warning:
      'border-amber-200/70 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/25',
    success:
      'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/25',
    info:
      'border-brand-200/70 bg-brand-50/70 dark:border-brand-900/50 dark:bg-brand-950/25',
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
    <h3 className={`text-sm font-bold tracking-tight text-[var(--text-1)] ${className}`.trim()}>
      {children}
    </h3>
  )
}

export function CardDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mt-1 text-sm leading-relaxed text-[var(--text-2)] ${className}`.trim()}>{children}</p>
  )
}

export function CardEyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] ${className}`.trim()}
    >
      {children}
    </p>
  )
}
