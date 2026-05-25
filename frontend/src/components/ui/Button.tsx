import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

const variants = {
  primary:
    'bg-brand-500 text-white shadow-[0_2px_10px_-2px_rgba(var(--color-brand-500),0.5)] ring-1 ring-brand-400/40 hover:bg-brand-400 hover:shadow-[0_4px_14px_-2px_rgba(var(--color-brand-500),0.6)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all',
  secondary:
    'border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-1)] shadow-sm hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)] transition-all',
  danger:
    'border border-red-300/70 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 transition-all',
  ghost:
    'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:bg-[var(--surface-3)] transition-all',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-xs font-bold rounded-lg',
  md: 'px-4 py-2.5 text-sm font-bold rounded-xl',
  lg: 'px-6 py-3.5 text-base font-bold rounded-xl',
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
    'inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]'
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
