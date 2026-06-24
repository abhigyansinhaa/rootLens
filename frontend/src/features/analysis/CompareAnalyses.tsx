
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from '../../components/ui'
import { formatPct01 } from '../../components/kpi/format'
import type { Analysis } from '../../types'
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus
} from 'lucide-react'

/* ─── helpers ─────────────────────────────────────────────────────────── */
function delta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null
  return a - b
}

function DeltaPill({ value, fmt }: { value: number | null; fmt: (n: number) => string }) {
  if (value == null) return <span className="text-(--text-4) text-xs">—</span>
  const pos = value > 0
  const zero = Math.abs(value) < 0.001
  return (
    <span className={[
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
      zero
        ? 'bg-(--surface-3) text-(--text-3)'
        : pos
          ? 'bg-(--c-success-bg) text-(--c-success)'
          : 'bg-(--c-danger-bg) text-(--c-danger)',
    ].join(' ')}>
      {zero ? <Minus className="h-3 w-3" /> : pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {zero ? 'no change' : `${pos ? '+' : ''}${fmt(value)}`}
    </span>
  )
}

function MetricRow({
  label,
  a,
  b,
  format = (n: number) => n.toFixed(4),
  invert = false,
}: {
  label: string
  a: number | null | undefined
  b: number | null | undefined
  format?: (n: number) => string
  invert?: boolean
}) {
  const d = delta(b, a)  // b - a = change from run A to run B
  const adjustedDelta = invert && d != null ? -d : d

  return (
    <tr className="border-b border-(--border-subtle) last:border-0">
      <td className="py-3 pr-4 text-xs text-(--text-3) font-semibold upperootLensse tracking-widest">{label}</td>
      <td className="py-3 pr-4 text-sm font-mono font-bold text-(--text-1) tabular-nums">
        {a != null ? format(a) : '—'}
      </td>
      <td className="py-3 pr-4 text-sm font-mono font-bold text-(--text-1) tabular-nums">
        {b != null ? format(b) : '—'}
      </td>
      <td className="py-3">
        <DeltaPill value={adjustedDelta} fmt={format} />
      </td>
    </tr>
  )
}

/* ─── Comparison page ────────────────────────────────────────────────── */
export function CompareAnalyses() {
  const [searchParams] = useSearchParams()
  const rawIds = searchParams.get('ids') ?? ''
  const ids = rawIds
    .split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 2)

  const queryA = useQuery({
    queryKey: ['analysis', ids[0]],
    queryFn: async () => { const { data } = await api.get<Analysis>(`/analyses/${ids[0]}`); return data },
    enabled: ids.length >= 1,
  })
  const queryB = useQuery({
    queryKey: ['analysis', ids[1]],
    queryFn: async () => { const { data } = await api.get<Analysis>(`/analyses/${ids[1]}`); return data },
    enabled: ids.length >= 2,
  })

  if (ids.length < 2) {
    return (
      <ErrorState
        title="Two analyses required"
        message="Add ?ids=A,B to the URL to compare two analysis runs side by side."
      />
    )
  }

  if (queryA.isLoading || queryB.isLoading) return <LoadingState rows={4} message="Loading analyses…" />
  if (queryA.error || queryB.error)
    return <ErrorState message="Could not load one or both analyses." onRetry={() => { queryA.refetch(); queryB.refetch() }} />

  const a = queryA.data!
  const b = queryB.data!
  const kA = a.report?.kpis
  const kB = b.report?.kpis

  const topDriversA = (kA?.drivers ?? []).slice(0, 5).map(d => d.feature)
  const topDriversB = (kB?.drivers ?? []).slice(0, 5).map(d => d.feature)
  const allDrivers = Array.from(new Set([...topDriversA, ...topDriversB]))

  function statusTone(s: string): 'success' | 'warning' | 'risk' | 'default' {
    if (s === 'completed') return 'success'
    if (s === 'completed_with_warnings') return 'warning'
    if (s === 'failed') return 'risk'
    return 'default'
  }

  return (
    <div className="space-y-8 animate-fade-in-up pb-20">
      <Link
        to="/analyses"
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--text-3) hover:text-(--brand) transition-colors print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to analyses
      </Link>

      <PageHeader
        eyebrow="Side-by-Side Comparison"
        title="Analysis Comparison"
        description="Delta view of business KPIs, model metrics, and top drivers across two runs."
      />

      {/* Run headers */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { run: a, label: 'Run A (baseline)' },
          { run: b, label: 'Run B (comparison)' },
        ].map(({ run, label }, i) => (
          <Card key={i} padding="lg" className="border border-(--border-subtle) bg-(--surface-1)">
            <p className="text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--text-3) mb-2">{label}</p>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-lg font-bold text-(--text-1)">Analysis #{run.id}</span>
              <StatusBadge tone={statusTone(run.status)}>{run.status}</StatusBadge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-(--text-2)">
              <div>
                <p className="text-(--text-3) mb-0.5">Target</p>
                <p className="font-semibold text-(--brand)">{run.target}</p>
              </div>
              <div>
                <p className="text-(--text-3) mb-0.5">Task type</p>
                <p className="font-semibold capitalize">{run.task_type?.replace('_', ' ') ?? '—'}</p>
              </div>
              <div>
                <p className="text-(--text-3) mb-0.5">Dataset</p>
                <p className="font-semibold truncate">Dataset #{run.dataset_id}</p>
              </div>
              <div>
                <p className="text-(--text-3) mb-0.5">Pipeline</p>
                <p className="font-mono font-semibold">{run.pipeline_version ?? '—'}</p>
              </div>
            </div>
            <Link
              to={`/analyses/${run.id}`}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-(--brand) hover:underline"
            >
              Open full report →
            </Link>
          </Card>
        ))}
      </div>

      {/* Business KPIs */}
      {kA && kB && (
        <section>
          <SectionHeader
            eyebrow="Business KPIs"
            title="Target & Revenue Delta"
            description="Positive delta (green) means Run B improved vs. Run A."
          />
          <Card padding="lg" className="mt-4 overflow-x-auto border border-(--border-subtle)">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-(--border-default)">
                  <th className="pb-3 pr-4 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--text-3)">Metric</th>
                  <th className="pb-3 pr-4 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--brand)">Run A #{a.id}</th>
                  <th className="pb-3 pr-4 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--c-info)">Run B #{b.id}</th>
                  <th className="pb-3 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--text-3)">Δ Change</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Target Rate" a={kA.target_level.target_rate} b={kB.target_level.target_rate} format={n => formatPct01(n, 2)} invert />
                <MetricRow label="Predicted Rate" a={kA.target_level.predicted_target_rate} b={kB.target_level.predicted_target_rate} format={n => formatPct01(n, 2)} invert />
                <MetricRow label="High-Risk Share" a={kA.target_level.high_risk_share} b={kB.target_level.high_risk_share} format={n => formatPct01(n, 2)} invert />
                <MetricRow label="N Users" a={kA.target_level.n_users} b={kB.target_level.n_users} format={n => n.toLocaleString()} />
                <MetricRow label="Gini" a={kA.concentration.gini} b={kB.concentration.gini} format={n => n.toFixed(4)} invert />
                {kA.impact_revenue && kB.impact_revenue && (
                  <MetricRow label="Revenue at Risk" a={kA.impact_revenue.revenue_at_risk} b={kB.impact_revenue.revenue_at_risk} format={n => `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} invert />
                )}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* Model metrics */}
      {a.metrics && b.metrics && (
        <section>
          <SectionHeader eyebrow="Model Performance" title="Metric Comparison" />
          <Card padding="lg" className="mt-4 overflow-x-auto border border-(--border-subtle)">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-(--border-default)">
                  <th className="pb-3 pr-4 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--text-3)">Metric</th>
                  <th className="pb-3 pr-4 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--brand)">Run A #{a.id}</th>
                  <th className="pb-3 pr-4 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--c-info)">Run B #{b.id}</th>
                  <th className="pb-3 text-left text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--text-3)">Δ Change</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set([...Object.keys(a.metrics), ...Object.keys(b.metrics)]))
                  .filter(k => k !== 'calibration_curve')
                  .map(k => (
                    <MetricRow
                      key={k}
                      label={k.toUpperootLensse()}
                      a={typeof a.metrics![k] === 'number' ? a.metrics![k] as number : null}
                      b={typeof b.metrics![k] === 'number' ? b.metrics![k] as number : null}
                    />
                  ))
                }
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* Driver overlap */}
      {kA && kB && allDrivers.length > 0 && (
        <section>
          <SectionHeader eyebrow="Driver Overlap" title="Top Driver Comparison" />
          <Card padding="lg" className="mt-4 border border-(--border-subtle)">
            <div className="grid gap-3">
              {allDrivers.map((feature, i) => {
                const rankA = topDriversA.indexOf(feature)
                const rankB = topDriversB.indexOf(feature)
                const inA = rankA >= 0
                const inB = rankB >= 0
                return (
                  <div
                    key={feature}
                    className={`flex items-center gap-4 rounded-md border p-3 animate-slide-in-right delay-${Math.min((i + 1) * 50, 400)} ${inA && inB ? 'border-(--border-brand) bg-(--brand-dim)' : 'border-(--border-subtle) bg-(--surface-2)'
                      }`}
                  >
                    <code className="flex-1 text-sm font-semibold text-(--text-1) truncate">{feature}</code>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      {inA ? (
                        <span className="text-(--brand) font-bold">A: #{rankA + 1}</span>
                      ) : (
                        <span className="text-(--text-4)">A: —</span>
                      )}
                      {inB ? (
                        <span className="text-(--c-info) font-bold">B: #{rankB + 1}</span>
                      ) : (
                        <span className="text-(--text-4)">B: —</span>
                      )}
                      {inA && inB && (
                        <StatusBadge tone="success" className="text-[9px]">shared</StatusBadge>
                      )}
                      {inA && !inB && (
                        <StatusBadge tone="default" className="text-[9px]">A only</StatusBadge>
                      )}
                      {!inA && inB && (
                        <StatusBadge tone="info" className="text-[9px]">B only</StatusBadge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
