import type { Analysis } from '../../../types'
import { Button, SectionHeader } from '../../../components/ui'
import { Download } from 'lucide-react'

interface LineageTabProps {
  data: Analysis
  onDownloadJson: () => void
}

export function LineageTab({ data, onDownloadJson }: LineageTabProps) {
  return (
    <div className="space-y-8 print:block animate-fade-in-up">
      <SectionHeader
        eyebrow="4. Lineage & Output"
        title="Audit Trail"
        description="System metadata and raw model configuration for reproducibility."
      />

      {/* Run Lineage */}
      <section
        className="rounded-lg border border-(--border-subtle) bg-(--surface-1) overflow-hidden"
        aria-label="Run lineage metadata"
      >
        <div className="border-b border-(--border-subtle) bg-(--surface-2) px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--brand)">
            Run Lineage
          </p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-(--border-subtle) md:grid-cols-2 md:divide-y-0 md:divide-x lg:grid-cols-4">
          {[
            { label: 'Pipeline Version', value: data.pipeline_version },
            { label: 'Encoder',          value: data.encoder_version  },
            { label: 'Dataset Hash',     value: data.dataset_hash     },
            { label: 'Schema Hash',      value: data.schema_hash      },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-3) mb-1">
                {label}
              </p>
              <code
                className="block truncate font-mono text-sm font-semibold text-(--text-1)"
                title={value ?? undefined}
              >
                {value ?? '—'}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* Analysis config */}
      <section
        className="rounded-lg border border-(--border-subtle) bg-(--surface-1) overflow-hidden"
        aria-label="Analysis configuration"
      >
        <div className="border-b border-(--border-subtle) bg-(--surface-2) px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--text-3)">
            Analysis Configuration
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-(--border-subtle) sm:grid-cols-4">
          {[
            { label: 'Analysis ID',   value: `#${data.id}` },
            { label: 'Target',        value: data.target },
            { label: 'Task Type',     value: data.task_type?.replace('_', ' ') ?? '—' },
            { label: 'Value Column',  value: data.value_column ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-3) mb-1">
                {label}
              </p>
              <p className="text-sm font-semibold text-(--text-1) capitalize">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Model metadata */}
      {data.model_metadata && Object.keys(data.model_metadata).length > 0 && (
        <div
          className="rounded-lg border border-(--border-subtle) bg-(--surface-1) overflow-hidden"
          aria-label="Model metadata"
        >
          <div className="flex items-center justify-between border-b border-(--border-subtle) bg-(--surface-2) px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--text-3)">
              Model Metadata
            </p>
            <Button size="xs" variant="secondary" type="button" onClick={onDownloadJson}>
              <Download className="h-3 w-3" /> JSON
            </Button>
          </div>
          <pre
            className="max-h-96 overflow-auto p-5 whitespace-pre-wrap wrap-break-word font-mono text-xs leading-relaxed text-(--text-2)"
            tabIndex={0}
            aria-label="Model metadata JSON"
          >
            {JSON.stringify(data.model_metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Reproducibility note */}
      <div className="rounded-lg border border-(--border-subtle) bg-(--brand-dimmer) p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--brand) mb-2">
          Reproducibility guarantee
        </p>
        <p className="text-sm leading-relaxed text-(--text-2)">
          The dataset hash and schema hash uniquely fingerprint the data used in this run. If either
          hash changes, the pipeline will detect a data drift event and flag the analysis accordingly.
          Pipeline version pins the exact ML code path — use it to reproduce results identically.
        </p>
      </div>
    </div>
  )
}
