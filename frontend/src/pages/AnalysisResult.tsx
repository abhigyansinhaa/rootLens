import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import {
  ConcentrationCallout,
  CounterfactualCallout,
  DriverImpactCard,
  KpiCard,
  ReliabilityBadge,
  RiskSegmentsChart,
} from '../components/kpi'
import { formatCompactMoney, formatNumber, formatPct01 } from '../components/kpi/format'
import {
  Button,
  Card,
  CardEyebrow,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionHeader,
  Stat,
  StatusBadge,
} from '../components/ui'
import type { Analysis } from '../types'

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'risk'
  if (status === 'queued' || status === 'running') return 'warning'
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

  const running = data.status === 'queued' || data.status === 'running'
  const kpis = data.report?.kpis
  const revenueReady = !!(kpis?.impact_revenue && data.value_column)

  return (
    <div className="space-y-10">
      <div>
        <Link
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 hover:underline dark:text-brand-300"
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
              </>
            }
            actions={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={downloadJson}
                  disabled={data.status !== 'completed'}
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

      {data.status === 'completed' && data.report?.user_message && (
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

      {data.status === 'completed' && kpis && (
        <>
          <section className="space-y-4">
            <SectionHeader
              eyebrow="1. Business impact"
              title="Top-line signals"
              description="Target behavior, high-risk exposure, monetized impact, and confidence before diving into model artifacts."
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                tone="brand"
                label={data.task_type === 'regression' ? 'Target baseline' : 'Target/churn rate'}
                value={metricValue(data, kpis)}
                hint={data.target}
              />
              <KpiCard
                tone="amber"
                label="High-risk users"
                value={formatPct01(kpis.target_level.high_risk_share)}
                hint={`${kpis.target_level.high_risk_count.toLocaleString()} rows above threshold`}
              />
              <KpiCard
                tone={kpis.impact_revenue ? 'risk' : 'default'}
                label="Revenue at risk"
                value={kpis.impact_revenue ? formatCompactMoney(kpis.impact_revenue.revenue_at_risk) : 'Not linked'}
                hint={
                  kpis.impact_revenue
                    ? `Value column: ${data.value_column ?? 'configured'}`
                    : 'Add a numeric value column on the next run'
                }
              />
              <KpiCard
                tone={
                  kpis.reliability.tier === 'high'
                    ? 'emerald'
                    : kpis.reliability.tier === 'low'
                      ? 'risk'
                      : 'amber'
                }
                label="Model performance"
                value={formatNumber(kpis.reliability.headline_value)}
                hint={`${kpis.reliability.headline_metric} - ${kpis.reliability.tier} confidence`}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ConcentrationCallout kpis={kpis} />
              <CounterfactualCallout kpis={kpis} regression={data.task_type === 'regression'} />
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="2. Why it is happening"
              title="Drivers, segments, and reliability"
              description="Feature lift, segment concentration, and reliability signals for where to intervene first."
            />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <RiskSegmentsChart kpis={kpis} hasValue={revenueReady} />
              <ReliabilityBadge kpis={kpis} />
            </div>
            <DriverImpactCard kpis={kpis} />
          </section>
        </>
      )}

      {data.status === 'completed' && data.metrics && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Confidence"
            title="Model metrics"
            description="Performance signals to decide how much confidence to place in the report."
          />
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.metrics).map(([k, v]) => (
              <Stat
                key={k}
                label={k.toUpperCase()}
                value={typeof v === 'number' ? v.toFixed(4) : String(v)}
                tone="info"
              />
            ))}
          </dl>
        </section>
      )}

      {data.status === 'completed' && chartData.length > 0 && (
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

      {data.status === 'completed' && data.shap_summary_image_url && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Evidence"
            title="SHAP summary plot"
            description="Distribution view for feature impact and direction."
          />
          <Card padding="lg" tone="strong">
            <img
              src={data.shap_summary_image_url}
              alt="SHAP summary"
              className="max-w-full rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)]"
            />
          </Card>
        </section>
      )}

      {data.status === 'completed' && data.insights && data.insights.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Narrative"
            title="Root-cause insights"
            description="Narratives that translate drivers into investigation hypotheses."
          />
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.insights.map((ins, i) => (
              <li key={i}>
                <Card padding="md" tone="strong" className="h-full">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="info">{ins.kind}</StatusBadge>
                    {ins.confidence && <StatusBadge tone="default">{ins.confidence}</StatusBadge>}
                  </div>
                  <p className="mt-3 font-mono text-sm font-bold text-brand-700 dark:text-brand-300">
                    {ins.feature}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-2)]">
                    {ins.summary}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.status === 'completed' && data.recommendations && data.recommendations.length > 0 && (
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
