import { forwardRef, useId } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?:     string
  hint?:      string
  error?:     string
  leftIcon?:  React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftIcon, rightIcon, className = '', id: propId, ...props }, ref) => {
    const autoId = useId()
    const id = propId ?? autoId

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="mb-1.5 block text-xs font-semibold text-(--text-2) tracking-wide"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-3)">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            className={[
              'w-full rounded-md',
              'border border-(--border-default)',
              'bg-(--surface-2)',
              'text-sm text-(--text-1)',
              'placeholder:text-(--text-3)',
              'transition-all duration-(--duration-normal)',
              'focus:outline-none focus:border-(--border-focus) focus:bg-(--surface-3)',
              'focus:shadow-[0_0_0_3px_hsl(214_100%_59%/0.15)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-(--critical) focus:border-(--critical) focus:shadow-[0_0_0_3px_hsl(0_84%_60%/0.15)]'
                : '',
              leftIcon  ? 'pl-9'  : 'px-3',
              rightIcon ? 'pr-9'  : '',
              'py-2.5',
              className,
            ].filter(Boolean).join(' ')}
            aria-invalid={!!error}
            aria-describedby={hint ? `${id}-hint` : error ? `${id}-error` : undefined}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-3)">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-(--critical)">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-(--text-3)">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
