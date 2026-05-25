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
import { formatDriverLabel } from '../../lib/driverLabels'
import type { Analysis, Dataset, KpiHistoryResponse } from '../../types'
import { ArrowLeft, Download, Printer, Settings2, BarChart3, Target, LayoutDashboard, ShieldCheck, FileJson, CheckCircle2, AlertCircle } from 'lucide-react'

type ViewPreset = 'executive' | 'analyst' | 'ops' | 'ds'

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
  return `${arrow} ${fmt(Math.abs(d))} vs prior analysis`
}

export function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const analysisId = Number(id)
  const [activeTab, setActiveTab] = useState<'impact' | 'drivers' | 'diagnostics' | 'lineage'>('impact')

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

  const rawColumnNames = useMemo(
    () => datasetMeta?.columns?.map((c) => c.name) ?? [],
    [datasetMeta?.columns],
  )

  const chartData = useMemo(() => {
    const fi = data?.feature_importance
    if (!fi?.length) return []
    return [...fi]
      .sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)
      .slice(0, 15)
      .map((r) => {
        const label = formatDriverLabel(r.feature, rawColumnNames)
        return {
          name: label.length > 28 ? `${label.slice(0, 26)}…` : label,
          full: label,
          importance: r.mean_abs_shap,
        }
      })
  }, [data?.feature_importance, rawColumnNames])

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
      ['drivers', 'top1', k.drivers[0] ? formatDriverLabel(k.drivers[0].feature, rawColumnNames) : ''],
      ['drivers', 'top1_share', String(k.drivers[0]?.share ?? '')],
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
    return <LoadingState rows={4} message="Loading analysis results…" />
  }

  const running = isInFlight(data.status)
  const finalOk = isTerminalOk(data.status)
  const kpis = data.report?.kpis
  const revenueReady = !!(kpis?.impact_revenue && data.value_column)

  return (
    <div data-analysis-result className="space-y-8 animate-fade-in-up pb-20">
      <div className="flex flex-col gap-4">
        <Link
          className="print:hidden inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-3)] hover:text-brand-500 transition-colors"
          to={`/datasets/${data.dataset_id}`}
        >
          <ArrowLeft className="h-4 w-4" /> Back to dataset dashboard
        </Link>
        <PageHeader
          eyebrow="Analysis Result"
          title={`Analysis #${data.id}`}
          description="Audit-ready RCA artifact. Use this report to confirm reliability, review drivers, and decide on actions."
          meta={
            <>
              <StatusBadge tone={statusTone(data.status)} dot>
                {running ? `${data.status}…` : data.status}
              </StatusBadge>
              {data.task_type && (
                <StatusBadge tone="info">{data.task_type.replace('_', ' ')}</StatusBadge>
              )}
              <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)]">
                Target:
                <code className="text-brand-600 dark:text-brand-400">
                  {data.target}
                </code>
              </span>
              {data.value_column && (
                <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)]">
                  Value:
                  <code className="text-emerald-600 dark:text-emerald-400">
                    {data.value_column}
                  </code>
                </span>
              )}
            </>
          }
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                className="print:hidden bg-white dark:bg-[var(--surface-2)] shadow-sm"
                to={`/datasets/${data.dataset_id}`}
              >
                Compare runs
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                className="shadow-sm"
                onClick={downloadCsvSummary}
                disabled={!finalOk || !data.report?.kpis}
              >
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="secondary" size="sm" type="button" className="shadow-sm" onClick={() => window.print()} disabled={!finalOk}>
                <Printer className="mr-2 h-4 w-4" /> Print / PDF
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Run id" value={`#${data.id}`} hint="Persistent identifier" />
        <Stat label="Status" value={<span className="capitalize">{data.status}</span>} tone={statusTone(data.status)} />
        <Stat label="Created" value={formatDateTime(data.created_at)} />
        <Stat label="Completed" value={formatDateTime(data.completed_at)} />
      </div>

      {data.status === 'failed' && (
        <ErrorState
          title="Analysis Failed"
          message={data.error || data.report?.user_message || 'An error occurred during analysis.'}
          onRetry={() => void refetch()}
          retryLabel="Refresh status"
        />
      )}

      {finalOk && kpis && (
        <>
          {/* Tab Navigation */}
          <div className="sticky top-[var(--app-header-height)] z-30 -mx-4 px-4 sm:mx-0 sm:px-0 bg-[var(--app-bg)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] print:hidden">
            <nav className="flex items-center gap-1 overflow-x-auto py-3 custom-scrollbar">
              <button
                onClick={() => setActiveTab('impact')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'impact' ? 'bg-brand-500 text-white shadow-md' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" /> 1. Business Impact
              </button>
              <button
                onClick={() => setActiveTab('drivers')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'drivers' ? 'bg-brand-500 text-white shadow-md' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
                }`}
              >
                <Target className="h-4 w-4" /> 2. Root Cause Drivers
              </button>
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'diagnostics' ? 'bg-brand-500 text-white shadow-md' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
                }`}
              >
                <ShieldCheck className="h-4 w-4" /> 3. Diagnostics & Quality
              </button>
              <button
                onClick={() => setActiveTab('lineage')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === 'lineage' ? 'bg-brand-500 text-white shadow-md' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
                }`}
              >
                <FileJson className="h-4 w-4" /> 4. Lineage & Raw Output
              </button>
            </nav>
          </div>

          <div className="mt-8 animate-fade-in-up print:block">
            {activeTab === 'impact' && (
              <div className="space-y-8 print:block">
                <SectionHeader
                  eyebrow="1. Business Impact"
                  title="Top-line signals"
                  description="Target behavior, high-risk exposure, monetized impact, and confidence."
                />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    tone={data.task_type === 'regression' ? 'brand' : predictedChurnTone(kpis.target_level.predicted_target_rate ?? kpis.target_level.target_rate)}
                    label={<span className="inline-flex items-center gap-1 font-bold">Target baseline</span>}
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
                    label={<span className="inline-flex items-center gap-1 font-bold">High-risk users</span>}
                    value={formatPct01(kpis.target_level.high_risk_share)}
                    hint={
                      <>
                        {`${kpis.target_level.high_risk_count.toLocaleString()} rows above threshold`}
                        {deltaVsPriorLine(history, (x) => x.high_risk_share, formatPct01) ? (
                          <span className="mt-1 block text-xs font-bold text-[var(--text-3)]">
                            {deltaVsPriorLine(history, (x) => x.high_risk_share, formatPct01)}
                          </span>
                        ) : null}
                      </>
                    }
                    ciHint={ciPct(kpis.target_level.high_risk_share_ci_low, kpis.target_level.high_risk_share_ci_high)}
                  />
                  <KpiCard
                    tone={kpis.impact_revenue ? concentrationShareTone(kpis.concentration.headline.share_of_risk) : 'default'}
                    label={<span className="font-bold">Revenue at risk</span>}
                    value={kpis.impact_revenue ? formatCompactMoney(kpis.impact_revenue.revenue_at_risk) : 'Not linked'}
                    hint={
                      <>
                        {kpis.impact_revenue ? `Value column: ${data.value_column}` : 'Add a numeric value column'}
                        {kpis.impact_revenue && deltaVsPriorLine(history, (x) => x.revenue_at_risk ?? null, formatCompactMoney) ? (
                          <span className="mt-1 block text-xs font-bold text-[var(--text-3)]">
                            {deltaVsPriorLine(history, (x) => x.revenue_at_risk ?? null, formatCompactMoney)}
                          </span>
                        ) : null}
                      </>
                    }
                    ciHint={kpis.impact_revenue ? ciMoney(kpis.impact_revenue.revenue_at_risk_ci_low, kpis.impact_revenue.revenue_at_risk_ci_high) : undefined}
                  />
                  <KpiCard
                    tone={
                      kpis.reliability.headline_metric === 'roc_auc'
                        ? rocAucTone(kpis.reliability.headline_value)
                        : kpis.reliability.tier === 'high' ? 'emerald' : kpis.reliability.tier === 'low' ? 'risk' : 'amber'
                    }
                    label={<span className="inline-flex items-center gap-1 font-bold">Model ({kpis.reliability.headline_metric})</span>}
                    value={formatNumber(kpis.reliability.headline_value)}
                    hint={`${kpis.reliability.tier} tier · ${kpis.intervention_confidence?.tier ?? '?'} intervention`}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <ConcentrationCallout kpis={kpis} />
                  <CounterfactualCallout
                    kpis={kpis}
                    regression={data.task_type === 'regression'}
                    trustCopy={data.report?.trust_copy}
                  />
                </div>

                {data.insights && data.insights.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-[var(--border-subtle)]">
                    <SectionHeader eyebrow="Narrative" title="Root-cause Insights" />
                    <ul className="grid gap-4 lg:grid-cols-2">
                      {data.insights.map((ins, i) => (
                        <li key={i}>
                          <Card padding="lg" tone={ins.severity === 'critical' ? 'risk' : 'strong'} elevated className="h-full border-t-[var(--border-subtle)] border-t-2">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <StatusBadge tone="info">{ins.kind}</StatusBadge>
                              {ins.confidence && <StatusBadge tone="default">{ins.confidence}</StatusBadge>}
                              {ins.severity && <StatusBadge tone={ins.severity === 'critical' ? 'risk' : 'warning'}>{ins.severity}</StatusBadge>}
                            </div>
                            <h3 className="text-base font-bold text-brand-600 dark:text-brand-400 mb-2">
                              {ins.display_label ?? formatDriverLabel(ins.feature, rawColumnNames)}
                            </h3>
                            <p className="text-sm leading-relaxed text-[var(--text-1)]">{ins.summary}</p>
                            {ins.investigation_questions?.length ? (
                              <div className="mt-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">Questions to investigate</p>
                                <ul className="list-disc space-y-1.5 pl-4 text-sm text-[var(--text-2)]">
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
                  </div>
                )}
              </div>
            )}

            {activeTab === 'drivers' && (
              <div className="space-y-8 print:block animate-fade-in-up">
                <SectionHeader
                  eyebrow="2. Why it is happening"
                  title="Drivers, Segments, and Reliability"
                  description="Feature lift, segment concentration, and reliability signals for where to intervene first."
                />
                
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <RiskSegmentsChart kpis={kpis} hasValue={revenueReady} />
                  <ReliabilityBadge kpis={kpis} />
                </div>
                
                <DriverImpactCard
                  kpis={kpis}
                  directionByFeature={directionByFeature}
                  roiAssumptions={data.report?.trust_copy?.roi_assumptions}
                  rawColumns={rawColumnNames}
                />

                {chartData.length > 0 && (
                  <div className="pt-6 border-t border-[var(--border-subtle)]">
                    <SectionHeader eyebrow="Drivers" title="Feature Importance" description="Mean absolute SHAP values rank the strongest explanatory drivers." />
                    <Card padding="lg" tone="strong" elevated className="mt-4 border border-[var(--border-subtle)] bg-[var(--surface-1)]/50 backdrop-blur">
                      <div className="h-96 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" className="opacity-40" />
                            <XAxis type="number" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 12, fontSize: 12, color: 'var(--text-1)' }}
                              formatter={(value) => [typeof value === 'number' ? value.toFixed(4) : String(value ?? ''), '|SHAP|']}
                              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ? String(payload[0].payload.full) : ''}
                            />
                            <Bar dataKey="importance" fill="url(#brandGradient)" radius={[0, 8, 8, 0]} />
                            <defs>
                              <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="var(--color-brand-400)" />
                                <stop offset="100%" stopColor="var(--color-brand-600)" />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                )}

                {data.shap_summary_image_url && (
                  <div className="pt-6 border-t border-[var(--border-subtle)]">
                    <SectionHeader eyebrow="Evidence" title="SHAP Plots" />
                    <div className="mt-4 grid gap-6 lg:grid-cols-2">
                      <Card padding="lg" tone="strong" elevated>
                        <CardEyebrow>Summary Plot</CardEyebrow>
                        <AuthenticatedApiImage
                          apiPath={data.shap_summary_image_url}
                          alt="SHAP summary"
                          lazy
                          className="mt-4 max-w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] mix-blend-luminosity hover:mix-blend-normal transition-all"
                        />
                      </Card>
                      {data.shap_beeswarm_image_url && (
                        <Card padding="lg" tone="strong" elevated>
                          <CardEyebrow>Beeswarm (Top Drivers)</CardEyebrow>
                          <AuthenticatedApiImage
                            apiPath={data.shap_beeswarm_image_url}
                            alt="SHAP beeswarm"
                            lazy
                            className="mt-4 max-w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] mix-blend-luminosity hover:mix-blend-normal transition-all"
                          />
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="space-y-8 print:block animate-fade-in-up">
                <SectionHeader
                  eyebrow="3. Diagnostics & Quality"
                  title="Data & Training Signals"
                  description="Structured checks from profiling, training, and fallbacks."
                />

                {data.report?.quality_signals && data.report.quality_signals.length > 0 && (
                  <Card padding="lg" tone="strong" elevated>
                    <CardEyebrow>Quality Alerts</CardEyebrow>
                    <div className="mt-4 flex flex-col gap-3">
                      {data.report.quality_signals.map((s, i) => (
                        <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${s.severity === 'critical' ? 'border-red-500/30 bg-red-500/10 text-red-600' : s.severity === 'info' ? 'border-blue-500/30 bg-blue-500/10 text-blue-600' : 'border-amber-500/30 bg-amber-500/10 text-amber-600'}`}>
                          {s.severity === 'critical' ? <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[10px] opacity-80">{s.scope}</p>
                            <p className="mt-1 text-sm font-medium">{s.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {data.metrics && (
                  <div className="pt-6 border-t border-[var(--border-subtle)]">
                    <SectionHeader eyebrow="Confidence" title="Model Metrics" description="Performance signals to decide how much confidence to place in the report." />
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {Object.entries(data.metrics)
                        .filter(([k, v]) => k !== 'calibration_curve' && typeof v === 'number' && Number.isFinite(v))
                        .map(([k, v]) => (
                          <Stat
                            key={k}
                            label={k.toUpperCase()}
                            value={(v as number).toFixed(4)}
                            tone="info"
                          />
                        ))}
                    </dl>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lineage' && (
              <div className="space-y-8 print:block animate-fade-in-up">
                <SectionHeader
                  eyebrow="4. Lineage & Output"
                  title="Audit Trail"
                  description="System metadata and raw model configuration for reproducibility."
                />
                
                <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-6 text-sm text-[var(--text-2)] shadow-inner">
                  <p className="font-bold uppercase tracking-widest text-brand-500 mb-4 text-xs">Run Lineage</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Pipeline Version</p>
                      <code className="text-[var(--text-1)] font-bold">{data.pipeline_version ?? '—'}</code>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Encoder</p>
                      <code className="text-[var(--text-1)] font-bold">{data.encoder_version ?? '—'}</code>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Dataset Hash</p>
                      <code className="text-[var(--text-1)] font-bold truncate block">{data.dataset_hash ?? '—'}</code>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">Schema Hash</p>
                      <code className="text-[var(--text-1)] font-bold truncate block">{data.schema_hash ?? '—'}</code>
                    </div>
                  </div>
                </section>

                {data.model_metadata && Object.keys(data.model_metadata).length > 0 && (
                  <Card padding="lg" tone="strong" elevated>
                    <div className="flex justify-between items-center mb-4">
                      <CardEyebrow>Model Metadata JSON</CardEyebrow>
                      <Button size="sm" variant="secondary" onClick={downloadJson}>Download Full JSON</Button>
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-lg bg-[var(--surface-3)]/50 p-4 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-1)] shadow-inner">
                      {JSON.stringify(data.model_metadata, null, 2)}
                    </pre>
                  </Card>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
