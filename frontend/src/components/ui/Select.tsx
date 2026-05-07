import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
}

export function Select({ label, hint, id, className = '', children, ...rest }: Props) {
  const selectId = id ?? rest.name
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-2)]"
        >
          {label}
        </label>
      )}
      <div className="relative mt-2">
        <select
          id={selectId}
          className={`w-full appearance-none rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] py-3 pl-4 pr-10 text-sm font-medium text-[var(--text-1)] shadow-sm transition-colors hover:border-[var(--border-2)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${className}`.trim()}
          {...rest}
        >
          {children}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.5 8l4.5 4.5L14.5 8z" />
          </svg>
        </span>
      </div>
      {hint && <p className="mt-1.5 text-xs text-[var(--text-3)]">{hint}</p>}
    </div>
  )
}
