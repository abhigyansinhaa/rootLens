import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../api/client'
import {
  ConcentrationCallout,
  CounterfactualCallout,
  DriverImpactCard,
  ReliabilityBadge,
  RiskSegmentsChart,
  ExecutiveSummaryHero,
  GovernancePanel,
} from '../../components/kpi'
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionHeader,
  Stat,
  StatusBadge,
} from '../../components/ui'
import { formatDriverLabel } from '../../lib/driverLabels'
import type { Analysis, Dataset } from '../../types'
import { ArrowLeft, Download, Printer, Target, LayoutDashboard, ShieldCheck, FileJson, CheckCircle2, AlertCircle } from 'lucide-react'

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

type TabId = 'impact' | 'drivers' | 'diagnostics' | 'lineage'
const VALID_TABS = new Set<string>(['impact', 'drivers', 'diagnostics', 'lineage'])

export function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const analysisId = Number(id)

  // ── URL-synced tab state ─────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') ?? 'impact'
  const activeTab: TabId = VALID_TABS.has(rawTab) ? (rawTab as TabId) : 'impact'
  const setActiveTab = (tab: TabId) => {
    setSearchParams(prev => { prev.set('tab', tab); return prev }, { replace: true })
  }
  // ────────────────────────────────────────────────────────────────────────



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

  const [heatmapColumn] = useState('')
  useQuery({
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
          className="print:hidden inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-3)] hover:text-[var(--brand)] transition-colors"
          to={`/datasets/${data.dataset_id}`}
        >
          <ArrowLeft className="h-4 w-4" /> Back to dataset
        </Link>
        <PageHeader
          eyebrow="Analysis Result"
          title={`Analysis #${data.id}`}
          description="Audit-ready rootLens artifact. Use this report to confirm reliability, review drivers, and decide on actions."
          meta={
            <>
              <StatusBadge tone={statusTone(data.status)} dot>
                {running ? `${data.status}…` : data.status}
              </StatusBadge>
              {data.task_type && (
                <StatusBadge tone="info">{data.task_type.replace('_', ' ')}</StatusBadge>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-brand)] bg-[var(--brand-dim)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
                <span className="text-[var(--text-3)] font-normal">target</span>
                {data.target}
              </span>
              {data.value_column && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--c-success-border)] bg-[var(--c-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--c-success)]">
                  <span className="text-[var(--text-3)] font-normal">value</span>
                  {data.value_column}
                </span>
              )}
            </>
          }
          actions={
            <>
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
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => window.print()} disabled={!finalOk}>
                <Printer className="h-3.5 w-3.5" /> PDF
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
          {/* ── Premium pill tab bar ── */}
          <div className="sticky top-[var(--app-header-height)] z-30 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 bg-[var(--app-bg)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] print:hidden">
            <nav className="flex items-center gap-1 overflow-x-auto" role="tablist">
              {([
                { id: 'impact',      label: '1. Business Impact',     icon: LayoutDashboard },
                { id: 'drivers',     label: '2. Root Cause Drivers',  icon: Target          },
                { id: 'diagnostics', label: '3. Trust Center',         icon: ShieldCheck     },
                { id: 'lineage',     label: '4. Lineage & Output',    icon: FileJson        },
              ] as const).map(tab => {
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'flex items-center gap-2 rounded-full px-4 py-2',
                      'text-sm font-semibold whitespace-nowrap',
                      'transition-all duration-[var(--duration-normal)]',
                      active
                        ? 'bg-[var(--brand-dim)] text-[var(--brand)] border border-[var(--border-brand)] shadow-[var(--shadow-glow)]'
                        : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] border border-transparent',
                    ].join(' ')}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="mt-8 animate-fade-in-up print:block">
            {activeTab === 'impact' && (
              <div className="space-y-8 print:block">
                <SectionHeader
                  eyebrow="1. Business Impact"
                  title="Executive Summary"
                  description="Target behavior, high-risk exposure, and monetized impact."
                />
                
                <ExecutiveSummaryHero detail={data} kpis={kpis} />

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
                    <SectionHeader eyebrow="Narrative" title="Why is this happening?" />
                    <ul className="grid gap-4 lg:grid-cols-2">
                      {data.insights.map((ins, i) => {
                        const sevTone = ins.severity === 'critical' ? 'risk' : 'warning'
                        const borderColor = ins.severity === 'critical' ? 'var(--c-danger)' : ins.severity === 'warning' ? 'var(--c-warning)' : 'var(--brand)'
                        return (
                          <li key={i} className={`animate-spring-up delay-${Math.min((i+1)*100, 400)}`}>
                            <div className="relative h-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5">
                              {/* Top accent */}
                              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: borderColor }} />

                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <StatusBadge tone="info">{ins.kind}</StatusBadge>
                                {ins.confidence && <StatusBadge tone="default">{ins.confidence}</StatusBadge>}
                                {ins.severity && <StatusBadge tone={sevTone}>{ins.severity}</StatusBadge>}
                              </div>

                              <h3 className="text-sm font-bold text-[var(--brand)] mb-2">
                                {ins.display_label ?? formatDriverLabel(ins.feature, rawColumnNames)}
                              </h3>
                              <p className="text-sm leading-relaxed text-[var(--text-1)]">{ins.summary}</p>

                              {ins.investigation_questions?.length ? (
                                <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)] mb-2">Investigate</p>
                                  <ul className="space-y-1.5">
                                    {ins.investigation_questions.map((q, qi) => (
                                      <li key={qi} className="flex items-start gap-2 text-xs text-[var(--text-2)]">
                                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-3)]" aria-hidden />
                                        {q}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
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
                  shapSummaryUrl={data.shap_summary_image_url}
                  shapBeeswarmUrl={data.shap_beeswarm_image_url}
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

              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="space-y-8 print:block animate-fade-in-up">
                <SectionHeader
                  eyebrow="3. Trust Center"
                  title="Confidence & Governance"
                  description="Model reliability metrics, quality alerts, and dataset governance."
                />

                <GovernancePanel governance={data.report?.governance} />

                {data.report?.quality_signals && data.report.quality_signals.length > 0 && (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)] mb-4">Quality Alerts</p>
                    <div className="flex flex-col gap-3">
                      {data.report.quality_signals.map((s, i) => {
                        const t = s.severity === 'critical' ? { bg: 'var(--c-danger-bg)', border: 'var(--c-danger-border)', text: 'var(--c-danger)', icon: AlertCircle } :
                                  s.severity === 'info'     ? { bg: 'var(--c-info-bg)',    border: 'var(--c-info-border)',    text: 'var(--c-info)',    icon: CheckCircle2 } :
                                                              { bg: 'var(--c-warning-bg)', border: 'var(--c-warning-border)', text: 'var(--c-warning)', icon: AlertCircle }
                        return (
                          <div key={i} className="flex items-start gap-3 rounded-[var(--radius-md)] border p-3.5" style={{ background: t.bg, borderColor: t.border }}>
                            <t.icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: t.text }} />
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-0.5" style={{ color: t.text }}>{s.scope}</p>
                              <p className="text-sm text-[var(--text-1)]">{s.message}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
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
                
                <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden">
                  <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-5 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand)]">Run Lineage</p>
                  </div>
                  <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] md:grid-cols-2 md:divide-y-0 md:divide-x lg:grid-cols-4">
                    {[
                      { label: 'Pipeline Version', value: data.pipeline_version },
                      { label: 'Encoder',          value: data.encoder_version  },
                      { label: 'Dataset Hash',     value: data.dataset_hash     },
                      { label: 'Schema Hash',      value: data.schema_hash      },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-5 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)] mb-1">{label}</p>
                        <code className="block truncate font-[var(--font-mono)] text-sm font-semibold text-[var(--text-1)]">{value ?? '—'}</code>
                      </div>
                    ))}
                  </div>
                </section>

                {data.model_metadata && Object.keys(data.model_metadata).length > 0 && (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-5 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">Model Metadata</p>
                      <Button size="xs" variant="secondary" onClick={downloadJson}>
                        <Download className="h-3 w-3" /> JSON
                      </Button>
                    </div>
                    <pre className="max-h-96 overflow-auto p-5 whitespace-pre-wrap break-words font-[var(--font-mono)] text-xs leading-relaxed text-[var(--text-2)]">
                      {JSON.stringify(data.model_metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
