import { useState, type ReactNode } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'

export function TrustAccordion({
  summary,
  defaultOpen = false,
  children,
}: {
  summary: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id="trust-section" data-trust-accordion data-print-tier="4" className="pt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 rounded-lg bg-(--surface-1) border border-(--border-subtle) px-5 py-4 text-left transition-colors hover:bg-(--surface-2)"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ShieldCheck className="h-5 w-5 text-(--text-3) shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-(--text-1)">Trust & compliance</h2>
            <p className="text-sm text-(--text-3) truncate mt-0.5">{summary}</p>
          </div>
        </div>
        <ChevronDown
          className={[
            'h-5 w-5 text-(--text-3) shrink-0 transition-transform duration-220',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>
      {open && (
        <div className="mt-6 space-y-8 animate-fade-in-up">
          {children}
        </div>
      )}
    </section>
  )
}
