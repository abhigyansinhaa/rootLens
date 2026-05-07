import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string | null
}

export function Input({ label, hint, error, id, className = '', ...rest }: Props) {
  const inputId = id ?? rest.name
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-2)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`mt-2 w-full rounded-xl border bg-[var(--surface-2)] px-4 py-3 text-[var(--text-1)] shadow-sm transition-colors placeholder:text-[var(--text-3)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
          error ? 'border-red-300 dark:border-red-800/70' : 'border-[var(--border-1)]'
        } ${label ? '' : 'mt-0'} ${className}`.trim()}
        {...rest}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-[var(--text-3)]">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
