import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

const variants = {
  primary:
    'bg-brand-500 text-white shadow-md shadow-brand-700/20 ring-1 ring-brand-400/40 hover:bg-brand-400 hover:shadow-lg hover:shadow-brand-700/25 dark:bg-brand-500 dark:text-slate-950 dark:ring-brand-300/40 dark:hover:bg-brand-400',
  secondary:
    'border border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-1)] hover:border-[var(--border-2)] hover:bg-[var(--surface-3)]',
  danger:
    'border border-red-300/70 bg-red-50/80 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60',
  ghost:
    'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
  md: 'px-4 py-2.5 text-sm font-semibold rounded-xl',
  lg: 'px-5 py-3 text-base font-semibold rounded-xl',
} as const

type Variant = keyof typeof variants
type Size = keyof typeof sizes

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children: ReactNode
  to?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  to,
  children,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]'
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()

  if (to) {
    return (
      <Link to={to} className={cls} aria-disabled={disabled ?? undefined}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} disabled={disabled} className={cls} {...rest}>
      {children}
    </button>
  )
}
