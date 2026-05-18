import type { ReactNode } from 'react'
import { Card, CardDescription, CardEyebrow, CardTitle } from '../ui'

function row(key: string, value: ReactNode) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--border-soft)] py-2 last:border-b-0">
      <dt className="text-[length:var(--font-label-xs)] font-bold uppercase tracking-wider text-[var(--text-3)]">
        {key}
      </dt>
      <dd className="max-w-[70%] text-right text-[length:var(--font-body-md)] text-[var(--text-1)]">{value}</dd>
    </div>
  )
}

export function GovernancePanel({ governance }: { governance: Record<string, unknown> | undefined }) {
  const entries = governance ? Object.entries(governance).filter(([, v]) => v !== undefined && v !== null) : []

  if (!entries.length) {
    return (
      <Card padding="md" tone="flat" className="border-[var(--border-soft)]">
        <CardEyebrow>Governance</CardEyebrow>
        <CardTitle className="mt-2 text-base">No governance metadata</CardTitle>
        <CardDescription className="mt-2">
          This run did not attach policy tags, approvals, or lineage objects. When the API supplies a governance
          payload, it will render here for audit reviews.
        </CardDescription>
      </Card>
    )
  }

  return (
    <Card padding="lg" tone="strong" className="border-[var(--border-subtle)]">
      <CardEyebrow>Governance</CardEyebrow>
      <CardTitle className="mt-2 text-base">Run governance snapshot</CardTitle>
      <CardDescription className="mt-2">
        Structured fields supplied by the pipeline for enterprise controls (exact schema may evolve).
      </CardDescription>
      <dl className="mt-4">
        {entries.map(([k, v]) =>
          row(
            k.replace(/_/g, ' '),
            typeof v === 'object' ? (
              <pre className="whitespace-pre-wrap break-all text-left font-mono text-[11px] leading-relaxed text-[var(--text-2)]">
                {JSON.stringify(v, null, 2)}
              </pre>
            ) : (
              String(v)
            ),
          ),
        )}
      </dl>
    </Card>
  )
}
