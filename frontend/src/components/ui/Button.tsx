import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'

type ButtonBaseProps = {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  disabled?: boolean
  className?: string
  children:  React.ReactNode
}

type ButtonProps =
  | (ButtonBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined })
  | (ButtonBaseProps & Omit<LinkProps, 'children'> & { to: string })

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-[var(--brand)] text-white font-semibold',
    'hover:brightness-110 hover:shadow-[0_0_24px_hsl(214_100%_59%/0.4)]',
    'active:brightness-95',
    'shadow-[0_0_0_1px_hsl(214_100%_59%/0.5),0_2px_8px_hsl(214_100%_59%/0.3)]',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:brightness-100',
  ].join(' '),

  secondary: [
    'bg-[var(--surface-2)] text-[var(--text-1)] font-medium',
    'border border-[var(--border-default)]',
    'hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]',
    'active:bg-[var(--surface-4)]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),

  ghost: [
    'bg-transparent text-[var(--text-2)] font-medium',
    'hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]',
    'active:bg-[var(--surface-3)]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-[var(--c-danger-bg)] text-[var(--c-danger)] font-semibold',
    'border border-[var(--c-danger-border)]',
    'hover:bg-[var(--c-danger)] hover:text-white hover:border-transparent',
    'hover:shadow-[0_0_20px_hsl(0_84%_60%/0.3)]',
    'active:brightness-90',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7  px-2.5 text-[11px] rounded-[var(--radius-sm)] gap-1.5',
  sm: 'h-8  px-3.5 text-xs    rounded-[var(--radius-md)] gap-2',
  md: 'h-10 px-5   text-sm    rounded-[var(--radius-md)] gap-2',
  lg: 'h-12 px-7   text-base  rounded-[var(--radius-lg)] gap-2.5',
}

const base = [
  'relative inline-flex items-center justify-center',
  'overflow-hidden select-none whitespace-nowrap',
  'transition-all duration-[var(--duration-normal)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--app-bg)]',
].join(' ')

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    const {
      variant  = 'primary',
      size     = 'md',
      loading  = false,
      disabled = false,
      className = '',
      children,
      ...rest
    } = props

    const classes = [base, variantClasses[variant], sizeClasses[size], className].join(' ')

    const content = loading ? (
      <>
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
        <span className="opacity-70">Loading…</span>
      </>
    ) : children

    if ('to' in rest && rest.to !== undefined) {
      const { to, ...linkRest } = rest as { to: string } & Record<string, unknown>
      return (
        <Link
          to={to}
          className={classes}
          ref={ref as React.Ref<HTMLAnchorElement>}
          {...(linkRest as Omit<LinkProps, 'to' | 'children'>)}
        >
          {content}
        </Link>
      )
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        disabled={disabled || loading}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    )
  }
)

Button.displayName = 'Button'
