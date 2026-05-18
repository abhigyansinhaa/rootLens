import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../api/client'
import { AuthenticatedApiImage } from '../../components/AuthenticatedApiImage'
import {
  ConcentrationCallout,
  CounterfactualCallout,
  DriverImpactCard,
  GovernancePanel,
  KpiCard,
  ReliabilityBadge,
  RiskSegmentsChart,
  StickyExecutiveStrip,
} from '../../components/kpi'
import {
  concentrationShareTone,
  highRiskShareTone,
  predictedChurnTone,
  rocAucTone,
} from '../../components/kpi/metricSemantics'
import { formatCompactMoney, formatNumber, formatPct01 } from '../../components/kpi/format'
import {
  Button,
  Card,
  CardEyebrow,
  ErrorState,
  HelpTooltip,
  LoadingState,
  PageHeader,
  SectionHeader,
  Stat,
  StatusBadge,
} from '../../components/ui'
import type { Analysis, Dataset, KpiHistoryResponse } from '../../types'

type ViewPreset = 'executive' | 'analyst' | 'ops' | 'ds'

function presetShowsTrendChart(p: ViewPreset) {
  return p !== 'executive'
}

function presetShowsHeatmap(p: ViewPreset) {
  return p === 'analyst' || p === 'ds'
}

function presetShowsModelMetadata(p: ViewPreset) {
  return p === 'analyst' || p === 'ds'
}

function presetShowsFeatureImportanceChart(p: ViewPreset) {
  return p === 'analyst' || p === 'ds'
}

function presetShowsShapPlots(p: ViewPreset) {
  return p === 'analyst' || p === 'ds'
}

const TERMINAL_OK_STATUSES = new Set(['completed', 'completed_with_warnings'])
const IN_FLIGHT_STATUSES = new Set([
  'queued',
  'running',
  'profiling',
  'training',
  'explaining',
  'decisioning',
])

function isTerminalOk(status: string): boolean {
  return TERMINAL_OK_STATUSES.has(status)
}

function isInFlight(status: string): boolean {
  return IN_FLIGHT_STATUSES.has(status)
}

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed') return 'risk'
  if (isInFlight(status)) return 'warning'
  return 'default'
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function metricValue(detail: Analysis, kpis: NonNullable<NonNullable<Analysis['report']>['kpis']>) {
  if (detail.task_type === 'regression') {
    return kpis.target_level.target_mean !== undefined
      ? formatNumber(kpis.target_level.target_mean, 4)
      : 'No baseline'
  }
  return kpis.target_level.target_rate !== undefined
    ? formatPct01(kpis.target_level.target_rate)
    : 'No baseline'
}

function ciPct(lo?: number, hi?: number) {
  if (lo === undefined || hi === undefined) return undefined
  return `95% CI ${formatPct01(lo)}–${formatPct01(hi)}`
}

function ciMoney(lo?: number, hi?: number) {
  if (lo === undefined || hi === undefined) return undefined
  return `95% CI ${formatCompactMoney(lo)}–${formatCompactMoney(hi)}`
}

function ciNum(lo?: number, hi?: number, digits = 4) {
  if (lo === undefined || hi === undefined) return undefined
  return `95% CI ${formatNumber(lo, digits)}–${formatNumber(hi, digits)}`
}

function deltaVsPriorLine(
  history: KpiHistoryResponse | undefined,
  pick: (k: KpiHistoryResponse['points'][0]['kpis']) => number | null | undefined,
  fmt: (n: number) => string,
): string | undefined {
  const pts = history?.points ?? []
  if (pts.length < 2) return undefined
  const a = pick(pts[pts.length - 2].kpis)
  const b = pick(pts[pts.length - 1].kpis)
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return undefined
  const d = b - a
  const arrow = d < 0 ? '↓' : '↑'
  return `${arrow} ${fmt(Math.abs(d))} vs prior analysis on this dataset`
}

export function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const analysisId = Number(id)

  const { data, error, refetch, isLoading } = useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const { data } = await api.get<Analysis>(`/analyses/${analysisId}`)
      return data
    },
    enabled: Number.isFinite(analysisId),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      if (s === 'completed' || s === 'failed') return false
      return 2000
    },
  })

  const chartData = useMemo(() => {
    const fi = data?.feature_importance
    if (!fi?.length) return []
    return [...fi]
      .sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)
      .slice(0, 15)
      .map((r) => ({
        name: r.feature.length > 28 ? `${r.feature.slice(0, 26)}…` : r.feature,
        full: r.feature,
        importance: r.mean_abs_shap,
      }))
  }, [data?.feature_importance])

  const directionByFeature = useMemo(() => {
    const m: Record<string, string> = {}
    if (!data) return m
    for (const r of data.report?.grouped_drivers ?? []) {
      if (r?.feature) m[r.feature] = r.direction
    }
    for (const r of data.shap_summary ?? []) {
      if (r?.feature) m[r.feature] = r.direction
    }
    return m
  }, [data])

  const { data: history } = useQuery({
    queryKey: ['analysis-kpi-history', analysisId],
    queryFn: async () => {
      const { data: h } = await api.get<KpiHistoryResponse>(`/analyses/${analysisId}/kpi-history`)
      return h
    },
    enabled: Number.isFinite(analysisId) && !!data && isTerminalOk(data.status),
  })

  const { data: datasetMeta } = useQuery({
    queryKey: ['dataset-columns', data?.dataset_id],
    queryFn: async () => {
      const { data: d } = await api.get<Dataset>(`/datasets/${data!.dataset_id}`)
      return d
    },
    enabled: Number.isFinite(analysisId) && !!data?.dataset_id && isTerminalOk(data.status),
  })

  const [heatmapColumn, setHeatmapColumn] = useState('')
  const { data: heatmapData } = useQuery({
    queryKey: ['risk-heatmap', analysisId, heatmapColumn],
    queryFn: async () => {
      const { data: h } = await api.get<{
        column: string
        groups: { value: string; count: number; mean_prediction: number; mean_expected_loss: number }[]
        partial_alignment_warning?: boolean
      }>(`/analyses/${analysisId}/risk-by-column`, { params: { column: heatmapColumn } })
      return h
    },
    enabled: Number.isFinite(analysisId) && !!heatmapColumn && !!data && isTerminalOk(data.status),
  })

  const [viewPreset, setViewPreset] = useState<ViewPreset>(() => {
    try {
      const v = sessionStorage.getItem('rca-view-preset')
      if (v === 'executive' || v === 'analyst' || v === 'ops' || v === 'ds') return v
    } catch {
      /* ignore */
    }
    return 'analyst'
  })

  const setPreset = (p: ViewPreset) => {
    setViewPreset(p)
    try {
      sessionStorage.setItem('rca-view-preset', p)
    } catch {
      /* ignore */
    }
  }

  const trendChart = useMemo(() => {
    const pts = history?.points ?? []
    return pts.map((p, xi) => ({
      xi,
      label: String(xi + 1),
      churn: p.kpis.predicted_target_rate ?? p.kpis.target_rate ?? 0,
      highRisk: p.kpis.high_risk_share ?? 0,
    }))
  }, [history])

  const downloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-${data.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadCsvSummary = () => {
    if (!data?.report?.kpis) return
    const k = data.report.kpis
    const rows: string[][] = [
      ['section', 'metric', 'value'],
      ['target', 'n_users', String(k.target_level.n_users)],
      ['target', 'target_rate', String(k.target_level.target_rate ?? '')],
      ['target', 'predicted_target_rate', String(k.target_level.predicted_target_rate ?? '')],
      ['target', 'high_risk_share', String(k.target_level.high_risk_share)],
      ['revenue', 'revenue_at_risk', String(k.impact_revenue?.revenue_at_risk ?? '')],
      ['concentration', 'gini', String(k.concentration.gini)],
      ['concentration', 'top_pct_users', String(k.concentration.headline.top_pct_users)],
      ['concentration', 'share_of_risk', String(k.concentration.headline.share_of_risk)],
      ['reliability', 'tier', k.reliability.tier],
      ['reliability', 'headline_metric', k.reliability.headline_metric],
      ['intervention', 'tier', k.intervention_confidence?.tier ?? ''],
      ['meta', 'pipeline_version', data.pipeline_version ?? ''],
      ['meta', 'analysis_created_at', data.created_at],
      ['drivers', 'top1', k.drivers[0]?.feature ?? ''],
      ['drivers', 'top1_share', String(k.drivers[0]?.share ?? '')],
      ['drivers', 'top2', k.drivers[1]?.feature ?? ''],
      ['drivers', 'top3', k.drivers[2]?.feature ?? ''],
    ]
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const body = rows.map((r) => r.map((c) => esc(String(c))).join(',')).join('\n')
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis-${data.id}-summary.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printExecutive = () => {
    window.print()
  }

  if (!Number.isFinite(analysisId)) {
    return (
      <Card padding="lg" tone="risk">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">Invalid analysis id.</p>
      </Card>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load analysis"
        message="The report may not exist or the server returned an error."
        onRetry={() => void refetch()}
      />
    )
  }

  if (isLoading || !data) {
    return <LoadingState rows={2} message="Loading analysis…" />
  }

  const running = isInFlight(data.status)
  const finalOk = isTerminalOk(data.status)
  const kpis = data.report?.kpis
  const revenueReady = !!(kpis?.impact_revenue && data.value_column)

  return (
    <div data-analysis-result className="analysis-result-page space-y-[var(--stack-gap)]">
      <div>
        <Link
          className="print:hidden inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 hover:underline dark:text-brand-300"
          to={`/datasets/${data.dataset_id}`}
        >
          <span aria-hidden>←</span> Back to dataset dashboard
        </Link>
        <div className="mt-3">
          <PageHeader
            eyebrow="Analysis result"
            title={`Analysis #${data.id}`}
            description={
              <span className="text-[var(--text-2)]">
                Audit-ready RCA artifact for the selected target. Use this report to confirm reliability,
                review drivers, and decide on actions.
              </span>
            }
            meta={
              <>
                <StatusBadge tone={statusTone(data.status)} dot>
                  {running ? `${data.status}…` : data.status}
                </StatusBadge>
                {data.task_type && (
                  <StatusBadge tone="info">{data.task_type.replace('_', ' ')}</StatusBadge>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-semibold text-[var(--text-2)]">
                  Target
                  <code className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-1)]">
                    {data.target}
                  </code>
                </span>
                {data.value_column && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-semibold text-[var(--text-2)]">
                    Value
                    <code className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-1)]">
                      {data.value_column}
                    </code>
                  </span>
                )}
                {data.datetime_column && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-semibold text-[var(--text-2)]">
                    Time order
                    <code className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-1)]">
                      {data.datetime_column}
                    </code>
                  </span>
                )}
              </>
            }
            actions={
              <>
                <select
                  className="print:hidden rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-1)]"
                  value={viewPreset}
                  onChange={(e) => setPreset(e.target.value as ViewPreset)}
                  aria-label="Dashboard preset"
                >
                  <option value="executive">Executive — summary KPIs & narrative</option>
                  <option value="analyst">Analyst — balanced evidence</option>
                  <option value="ops">Operations — KPIs & drivers (lighter plots)</option>
                  <option value="ds">Data science — full diagnostics</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  className="print:hidden"
                  to={`/datasets/${data.dataset_id}`}
                >
                  Compare runs
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={downloadCsvSummary}
                  disabled={!finalOk || !data.report?.kpis}
                >
                  CSV summary
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={printExecutive} disabled={!finalOk}>
                  Print / PDF
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={downloadJson}
                  disabled={!finalOk}
                >
                  Download JSON
                </Button>
              </>
            }
          />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Run id" value={`#${data.id}`} hint="Persistent run identifier" />
        <Stat label="Status" value={<span className="capitalize">{data.status}</span>} tone={statusTone(data.status)} />
        <Stat label="Created" value={formatDateTime(data.created_at)} />
        <Stat label="Completed" value={formatDateTime(data.completed_at)} />
      </section>

      {data.error && (
        <Card padding="md" tone="warning">
          <p className="text-sm text-amber-950 dark:text-amber-100">{data.error}</p>
        </Card>
      )}

      {data.status === 'failed' && (
        <ErrorState
          title="We couldn't finish this analysis"
          message={
            data.error ||
            data.report?.user_message ||
            'Something went wrong on our side. Please try again in a moment or pick a different target column.'
          }
          onRetry={() => void refetch()}
          retryLabel="Refresh status"
        />
      )}

      {finalOk && data.report?.user_message && (
        <Card padding="md" tone="info">
          <CardEyebrow>Operator note</CardEyebrow>
          <p className="mt-2 text-sm font-medium text-brand-950 dark:text-brand-100">
            {data.report.user_message}
          </p>
          {data.report.fallbacks && data.report.fallbacks.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-brand-900/90 dark:text-brand-200/90">
              {data.report.fallbacks.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {finalOk && kpis && (
        <>
          <StickyExecutiveStrip detail={data} kpis={kpis} history={history} />
          <section className="space-y-4 print:break-inside-avoid">
            <SectionHeader
              eyebrow="1. Business impact"
              title="Top-line signals"
              description="Target behavior, high-risk exposure, monetized impact, and confidence before diving into model artifacts."
            />
            {trendChart.length >= 2 && presetShowsTrendChart(viewPreset) ? (
              <Card padding="md" tone="strong">
                <CardEyebrow>Historical KPI trend (prior runs same dataset + target)</CardEyebrow>
                <div className="mt-2 h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChart} margin={{ left: -8, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" className="opacity-60" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                      <YAxis yAxisId="l" domain={[0, 1]} tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--surface-2)',
                          border: '1px solid var(--border-1)',
                          borderRadius: 12,
                          fontSize: 11,
                        }}
                      />
                      <Line
                        yAxisId="l"
                        type="monotone"
                        dataKey="churn"
                        stroke="var(--chart-primary)"
                        strokeWidth={2}
                        dot
                        name="Predicted / target rate"
                      />
                      <Line
                        yAxisId="l"
                        type="monotone"
                        dataKey="highRisk"
                        stroke="var(--chart-warning)"
                        strokeWidth={2}
                        dot
                        name="High-risk share"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                tone={
                  data.task_type === 'regression'
                    ? 'brand'
                    : predictedChurnTone(kpis.target_level.predicted_target_rate ?? kpis.target_level.target_rate)
                }
                label={
                  <span className="inline-flex items-center gap-1">
                    {data.task_type === 'regression' ? 'Target baseline' : (
                      <>
                        <HelpTooltip title="Observed or baseline positive rate in the scored cohort.">Churn / positive rate</HelpTooltip>
                      </>
                    )}
                  </span>
                }
                value={metricValue(data, kpis)}
                hint={data.target}
                ciHint={
                  data.task_type === 'regression'
                    ? ciNum(kpis.target_level.target_mean_ci_low, kpis.target_level.target_mean_ci_high)
                    : ciPct(kpis.target_level.target_rate_ci_low, kpis.target_level.target_rate_ci_high)
                }
              />
              <KpiCard
                tone={highRiskShareTone(kpis.target_level.high_risk_share)}
                label={
                  <span className="inline-flex items-center gap-1">
                    <HelpTooltip title="Share of rows above the high-risk score threshold used in this run.">High-risk users</HelpTooltip>
                  </span>
                }
                value={formatPct01(kpis.target_level.high_risk_share)}
                hint={
                  <>
                    {`${kpis.target_level.high_risk_count.toLocaleString()} rows above threshold`}
                    {deltaVsPriorLine(history, (x) => x.high_risk_share, (n) => formatPct01(n)) ? (
                      <span className="mt-1 block text-[10px] font-bold text-[var(--text-3)]">
                        {deltaVsPriorLine(history, (x) => x.high_risk_share, (n) => formatPct01(n))}
                      </span>
                    ) : null}
                  </>
                }
                ciHint={ciPct(
                  kpis.target_level.high_risk_share_ci_low,
                  kpis.target_level.high_risk_share_ci_high,
                )}
              />
              <KpiCard
                tone={
                  kpis.impact_revenue
                    ? concentrationShareTone(kpis.concentration.headline.share_of_risk)
                    : 'default'
                }
                label="Revenue at risk"
                value={kpis.impact_revenue ? formatCompactMoney(kpis.impact_revenue.revenue_at_risk) : 'Not linked'}
                hint={
                  <>
                    {kpis.impact_revenue
                      ? `Value column: ${data.value_column ?? 'configured'}`
                      : 'Add a numeric value column on the next run'}
                    {kpis.impact_revenue && deltaVsPriorLine(history, (x) => x.revenue_at_risk ?? null, (n) => formatCompactMoney(n)) ? (
                      <span className="mt-1 block text-[10px] font-bold text-[var(--text-3)]">
                        {deltaVsPriorLine(history, (x) => x.revenue_at_risk ?? null, (n) => formatCompactMoney(n))}
                      </span>
                    ) : null}
                  </>
                }
                ciHint={
                  kpis.impact_revenue
                    ? ciMoney(
                        kpis.impact_revenue.revenue_at_risk_ci_low,
                        kpis.impact_revenue.revenue_at_risk_ci_high,
                      )
                    : undefined
                }
              />
              <KpiCard
                tone={
                  kpis.reliability.headline_metric === 'roc_auc'
                    ? rocAucTone(kpis.reliability.headline_value)
                    : kpis.reliability.tier === 'high'
                      ? 'emerald'
                      : kpis.reliability.tier === 'low'
                        ? 'risk'
                        : 'amber'
                }
                label={
                  <span className="inline-flex items-center gap-1">
                    <HelpTooltip title="Discrimination metric on the holdout fold; not the same as calibration.">
                      Model performance ({kpis.reliability.headline_metric})
                    </HelpTooltip>
                  </span>
                }
                value={formatNumber(kpis.reliability.headline_value)}
                hint={`${kpis.reliability.tier} tier · ${kpis.intervention_confidence?.tier ?? '?'} intervention`}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ConcentrationCallout kpis={kpis} />
              <CounterfactualCallout
                kpis={kpis}
                regression={data.task_type === 'regression'}
                trustCopy={data.report?.trust_copy}
              />
            </div>
          </section>

          {data.report?.quality_signals && data.report.quality_signals.length > 0 && viewPreset !== 'executive' ? (
            <section className="space-y-3">
              <SectionHeader
                eyebrow="Quality"
                title="Data & training signals"
                description="Structured checks from profiling, training, and fallbacks."
              />
              <div className="flex flex-wrap gap-2">
                {data.report.quality_signals.map((s, i) => (
                  <StatusBadge key={i} tone={s.severity === 'critical' ? 'risk' : s.severity === 'info' ? 'info' : 'warning'}>
                    {s.scope}: {s.message}
                  </StatusBadge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4 print:break-inside-avoid">
            <SectionHeader
              eyebrow="2. Why it is happening"
              title="Drivers, segments, and reliability"
              description="Feature lift, segment concentration, and reliability signals for where to intervene first."
            />
            {(() => {
              const pts = history?.points ?? []
              let driftEl = null
              if (pts.length >= 2) {
                const prev = pts[pts.length - 2].kpis.segment_shares?.high
                const cur = pts[pts.length - 1].kpis.segment_shares?.high
                if (prev != null && cur != null && Number.isFinite(prev) && Number.isFinite(cur)) {
                  const d = cur - prev
                  driftEl = (
                    <p className="text-xs font-semibold text-[var(--text-2)]">
                      High-risk segment share {d >= 0 ? 'rose' : 'fell'} by {formatPct01(Math.abs(d))} vs prior completed
                      analysis on this dataset (same target).
                    </p>
                  )
                }
              }
              return driftEl
            })()}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <RiskSegmentsChart kpis={kpis} hasValue={revenueReady} />
              <ReliabilityBadge kpis={kpis} />
            </div>
            <DriverImpactCard
              kpis={kpis}
              directionByFeature={directionByFeature}
              roiAssumptions={data.report?.trust_copy?.roi_assumptions}
            />
            <GovernancePanel governance={data.report?.governance} />
          </section>

          {datasetMeta && presetShowsHeatmap(viewPreset) ? (
            <section className="space-y-4">
              <SectionHeader
                eyebrow="Risk heatmap"
                title="Concentration by categorical column"
                description="Pick a column to compare average modeled risk and loss proxy across levels (current run)."
              />
              <Card padding="md" tone="strong">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Breakdown column</label>
                <select
                  className="mt-2 w-full max-w-md rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                  value={heatmapColumn}
                  onChange={(e) => setHeatmapColumn(e.target.value)}
                >
                  <option value="">Select column…</option>
                  {datasetMeta.columns
                    .filter((c) => c.name !== data.target)
                    .map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.dtype})
                      </option>
                    ))}
                </select>
                {heatmapData?.partial_alignment_warning ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Row alignment between training cohort and stored predictions may be partial — interpret as directional.
                  </p>
                ) : null}
                {heatmapData?.groups?.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {heatmapData.groups.map((g) => (
                      <div
                        key={g.value}
                        className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-3 text-xs"
                      >
                        <p className="font-bold text-[var(--text-1)]">{g.value}</p>
                        <p className="mt-1 text-[var(--text-2)]">
                          n={g.count.toLocaleString()} · mean risk {g.mean_prediction.toFixed(3)} · loss proxy{' '}
                          {g.mean_expected_loss.toFixed(3)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : heatmapColumn ? (
                  <p className="mt-3 text-sm text-[var(--text-3)]">Loading or no groups…</p>
                ) : null}
              </Card>
            </section>
          ) : null}
        </>
      )}

      {finalOk && data.model_metadata && Object.keys(data.model_metadata).length > 0 && presetShowsModelMetadata(viewPreset) && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Training"
            title="Model metadata"
            description="Hyperparameters, timing, and feature inventory from this run."
          />
          <Card padding="lg" tone="strong">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-2)]">
              {JSON.stringify(data.model_metadata, null, 2)}
            </pre>
          </Card>
        </section>
      )}

      {finalOk && data.metrics && presetShowsTrendChart(viewPreset) && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Confidence"
            title="Model metrics"
            description="Performance signals to decide how much confidence to place in the report."
          />
          {data.report?.model_baselines ? (
            <Card padding="md" tone="info">
              <CardEyebrow>Baselines</CardEyebrow>
              <p className="mt-2 text-xs text-[var(--text-2)]">
                Random classifier ROC AUC ≈ {data.report.model_baselines.random_classifier_roc_auc?.toFixed(2) ?? '0.50'}
                {data.report.model_baselines.logistic_regression_roc_auc != null
                  ? ` · Logistic baseline ROC AUC ${data.report.model_baselines.logistic_regression_roc_auc.toFixed(3)}`
                  : null}
              </p>
            </Card>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.metrics)
              .filter(([k, v]) => k !== 'calibration_curve' && typeof v === 'number' && Number.isFinite(v))
              .map(([k, v]) => (
                <Stat
                  key={k}
                  label={
                    <span className="inline-flex items-center gap-1">
                      {k.toUpperCase()}
                      {k === 'brier_score_loss' ? (
                        <HelpTooltip title="Mean squared error of probabilities; lower is better-calibrated for risk.">
                          ⓘ
                        </HelpTooltip>
                      ) : null}
                    </span>
                  }
                  value={(v as number).toFixed(4)}
                  tone="info"
                />
              ))}
          </dl>
          {Array.isArray(data.metrics.calibration_curve) && data.metrics.calibration_curve.length > 1 ? (
            <Card padding="md" tone="strong">
              <CardEyebrow>Calibration curve (holdout)</CardEyebrow>
              <p className="mt-1 text-xs text-[var(--text-2)]">
                <HelpTooltip title="Each point compares mean predicted probability to observed positive rate in a bin.">
                  Reliability of predicted probabilities
                </HelpTooltip>
              </p>
              <div className="mt-3 h-48 w-full max-w-lg">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(data.metrics.calibration_curve as { mean_predicted: number; fraction_positive: number }[]).map(
                      (p) => ({
                        x: p.mean_predicted,
                        y: p.fraction_positive,
                      }),
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" className="opacity-60" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} name="Pred" />
                    <YAxis dataKey="y" tick={{ fontSize: 10 }} domain={[0, 1]} name="Observed" />
                    <Tooltip />
                    <Line type="monotone" dataKey="y" stroke="var(--chart-primary)" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}
        </section>
      )}

      {finalOk && chartData.length > 0 && presetShowsFeatureImportanceChart(viewPreset) && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Drivers"
            title="Feature importance"
            description="Mean absolute SHAP values rank the strongest explanatory drivers."
          />
          <Card padding="lg" tone="strong">
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" className="opacity-60" />
                  <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11, fill: 'var(--text-2)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border-1)',
                      borderRadius: 12,
                      fontSize: 12,
                      color: 'var(--text-1)',
                    }}
                    formatter={(value) => [
                      typeof value === 'number' ? value.toFixed(4) : String(value ?? ''),
                      '|SHAP|',
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.full ? String(payload[0].payload.full) : ''
                    }
                  />
                  <Bar dataKey="importance" fill="var(--chart-primary)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      )}

      {finalOk && data.shap_summary_image_url && presetShowsShapPlots(viewPreset) && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Evidence"
            title="SHAP summary plot"
            description={
              <>
                Distribution view for feature impact and direction.{' '}
                <HelpTooltip title="SHAP values attribute how much each feature pushes an individual prediction away from the baseline.">
                  What is SHAP?
                </HelpTooltip>
              </>
            }
          />
          <Card padding="lg" tone="strong">
            <AuthenticatedApiImage
              key={`shap-${data.id}-${data.shap_summary_image_url}`}
              apiPath={data.shap_summary_image_url}
              alt="SHAP summary"
              lazy
              className="max-w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-1)]"
            />
          </Card>
          {data.shap_beeswarm_image_url ? (
            <Card padding="lg" tone="strong">
              <CardEyebrow>SHAP beeswarm (top drivers)</CardEyebrow>
              <AuthenticatedApiImage
                key={`shap-bw-${data.id}-${data.shap_beeswarm_image_url}`}
                apiPath={data.shap_beeswarm_image_url}
                alt="SHAP beeswarm"
                lazy
                className="max-w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-1)]"
              />
            </Card>
          ) : null}
        </section>
      )}

      {finalOk && data.insights && data.insights.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Narrative"
            title="Root-cause insights"
            description="Narratives that translate drivers into investigation hypotheses."
          />
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.insights.map((ins, i) => (
              <li key={i}>
                <Card
                  padding="md"
                  tone={
                    ins.severity === 'critical' ? 'risk' : ins.severity === 'warning' ? 'strong' : 'strong'
                  }
                  className="h-full"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{ins.kind}</StatusBadge>
                    {ins.confidence && <StatusBadge tone="default">{ins.confidence}</StatusBadge>}
                    {ins.severity ? (
                      <StatusBadge
                        tone={ins.severity === 'critical' ? 'risk' : ins.severity === 'warning' ? 'warning' : 'default'}
                      >
                        {ins.severity}
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-3 font-mono text-sm font-bold text-brand-700 dark:text-brand-300">
                    {ins.feature}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-2)]">
                    {ins.summary}
                  </p>
                  {ins.investigation_questions?.length ? (
                    <div className="mt-4 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/60 p-3 text-xs text-[var(--text-2)]">
                      <p className="font-bold text-[var(--text-1)]">Questions to investigate</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4">
                        {ins.investigation_questions.map((q, qi) => (
                          <li key={qi}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finalOk && (
        <section className="space-y-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)]/40 p-4 text-[11px] text-[var(--text-2)] print:break-inside-avoid">
          <p className="font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">Audit lineage</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Pipeline <code className="text-[var(--text-1)]">{data.pipeline_version ?? '—'}</code>
            </span>
            <span>
              Encoder <code className="text-[var(--text-1)]">{data.encoder_version ?? '—'}</code>
            </span>
            <span>
              Dataset hash <code className="break-all text-[var(--text-1)]">{data.dataset_hash ?? '—'}</code>
            </span>
            <span>
              Schema hash <code className="break-all text-[var(--text-1)]">{data.schema_hash ?? '—'}</code>
            </span>
          </div>
        </section>
      )}

      {finalOk && data.recommendations && data.recommendations.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Actions"
            title="Recommendations"
            description="Suggested next moves from the completed RCA run."
          />
          <Card padding="lg" tone="info">
            <ol className="space-y-3 text-sm leading-6 text-[var(--text-1)]">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 font-mono text-[11px] font-black text-white">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">{r}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}
    </div>
  )
}
