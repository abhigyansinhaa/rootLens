import type { Analysis } from '../../../types'
import { GovernancePanel } from '../../../components/kpi'
import { SectionHeader, Stat, StatusBadge } from '../../../components/ui'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface DiagnosticsTabProps {
  data: Analysis
}

export function DiagnosticsTab({ data }: DiagnosticsTabProps) {
  return (
    <div className="space-y-8 print:block">
      <GovernancePanel governance={data.report?.governance} />

      {data.report?.quality_signals && data.report.quality_signals.length > 0 && (
        <div className="rounded-lg border border-(--border-subtle) bg-(--surface-1) p-5">
          <p className="text-[11px] font-bold upperootLensse tracking-[0.14em] text-(--text-3) mb-4">
            Quality Alerts
          </p>
          <div className="flex flex-col gap-3" role="list" aria-label="Quality alerts">
            {data.report.quality_signals.map((s, i) => {
              const t =
                s.severity === 'critical'
                  ? {
                    bg: 'var(--c-danger-bg)',
                    border: 'var(--c-danger-border)',
                    text: 'var(--c-danger)',
                    icon: AlertCircle,
                  }
                  : s.severity === 'info'
                    ? {
                      bg: 'var(--c-info-bg)',
                      border: 'var(--c-info-border)',
                      text: 'var(--c-info)',
                      icon: CheckCircle2,
                    }
                    : {
                      bg: 'var(--c-warning-bg)',
                      border: 'var(--c-warning-border)',
                      text: 'var(--c-warning)',
                      icon: AlertCircle,
                    }
              const Icon = t.icon
              return (
                <div
                  key={i}
                  role="listitem"
                  className="flex items-start gap-3 rounded-md border p-3.5"
                  style={{ background: t.bg, borderColor: t.border }}
                >
                  <Icon
                    className="h-4 w-4 shrink-0 mt-0.5"
                    style={{ color: t.text }}
                    aria-hidden
                  />
                  <div>
                    <p
                      className="text-[10px] font-bold upperootLensse tracking-[0.14em] mb-0.5"
                      style={{ color: t.text }}
                    >
                      {s.scope}
                    </p>
                    <p className="text-sm text-(--text-1)">{s.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.metrics && (
        <div className="pt-6 border-t border-(--border-subtle)">
          <SectionHeader
            eyebrow="Confidence"
            title="Model Metrics"
            description="Performance signals to decide how much confidence to place in the report."
          />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.metrics)
              .filter(
                ([k, v]) =>
                  k !== 'calibration_curve' && typeof v === 'number' && Number.isFinite(v),
              )
              .map(([k, v]) => (
                <Stat
                  key={k}
                  label={k.toUpperootLensse()}
                  value={(v as number).toFixed(4)}
                  tone="info"
                />
              ))}
          </dl>
        </div>
      )}

      {/* Interpretation guide */}
      <div className="rounded-lg border border-(--border-subtle) bg-(--surface-1) p-5">
        <p className="text-[11px] font-bold upperootLensse tracking-[0.14em] text-(--text-3) mb-4">
          How to read this report
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              badge: <StatusBadge tone="success">High reliability</StatusBadge>,
              text: 'Model generalises well. Decisions can be made with confidence.',
            },
            {
              badge: <StatusBadge tone="warning">Medium reliability</StatusBadge>,
              text: 'Use findings as directional signals. Validate with domain experts.',
            },
            {
              badge: <StatusBadge tone="risk">Low reliability</StatusBadge>,
              text: 'Insufficient data or poor target signal. Treat output as exploratory only.',
            },
          ].map(({ badge, text }, i) => (
            <div
              key={i}
              className="rounded-md border border-(--border-subtle) bg-(--surface-2) p-4"
            >
              <div className="mb-2">{badge}</div>
              <p className="text-xs leading-relaxed text-(--text-2)">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
