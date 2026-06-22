import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?:    string
  hint?:     string
  error?:    string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className = '', id: propId, children, ...props }, ref) => {
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
          <select
            ref={ref}
            id={id}
            className={[
              'w-full appearance-none rounded-md',
              'border border-(--border-default)',
              'bg-(--surface-2)',
              'px-3 py-2.5 pr-9',
              'text-sm text-(--text-1)',
              'transition-all duration-(--duration-normal)',
              'focus:outline-none focus:border-(--border-focus) focus:bg-(--surface-3)',
              'focus:shadow-[0_0_0_3px_hsl(214_100%_59%/0.15)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-(--c-danger)' : '',
              className,
            ].filter(Boolean).join(' ')}
            aria-invalid={!!error}
            {...props}
          >
            {children}
          </select>

          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-3)"
            aria-hidden
          />
        </div>

        {error && (
          <p className="mt-1.5 text-xs font-medium text-(--c-danger)">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-(--text-3)">{hint}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
