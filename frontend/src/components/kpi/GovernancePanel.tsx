import type { ReactNode } from 'react'
import { Card, CardEyebrow } from '../ui'

function row(key: string, value: ReactNode) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-(--border-subtle) py-2.5 last:border-b-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--text-3)">
        {key}
      </dt>
      <dd className="max-w-[70%] text-right text-sm text-(--text-1) font-medium break-words break-all">{value}</dd>
    </div>
  )
}

export function GovernancePanel({ governance }: { governance: Record<string, unknown> | undefined }) {
  const entries = governance ? Object.entries(governance).filter(([, v]) => v !== undefined && v !== null) : []

  if (!entries.length) {
    return (
      <div className="rounded-lg border border-(--border-subtle) bg-(--surface-1) p-5">
        <CardEyebrow className="mb-2">Governance</CardEyebrow>
        <p className="text-base font-bold text-(--text-1)">No governance metadata</p>
        <p className="mt-1.5 text-sm text-(--text-2)">
          This run did not attach policy tags, approvals, or lineage objects.
        </p>
      </div>
    )
  }

  return (
    <Card padding="lg" tone="strong">
      <CardEyebrow className="mb-2">Governance</CardEyebrow>
      <p className="text-base font-bold text-(--text-1)">Run governance snapshot</p>
      <p className="mt-1 text-sm text-(--text-2) mb-4">
        Structured fields supplied by the pipeline for enterprise controls.
      </p>
      <dl>
        {entries.map(([k, v]) =>
          row(
            k.replace(/_/g, ' '),
            typeof v === 'object' ? (
              <pre className="whitespace-pre-wrap break-all text-left font-mono text-[11px] leading-relaxed text-(--text-2)">
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
