import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import {
  Button,
  Card,
  ErrorState,
  PageHeader,
  SkeletonBlock,
  SkeletonGroup,
  SkeletonLine,
  SkeletonStat,
  Stat,
  StatusBadge,
} from '../../components/ui'
import { ExportHub } from '../../components/ExportHub'
import { formatDriverLabel } from '../../lib/driverLabels'
import type { Analysis, Dataset, KpiHistoryResponse } from '../../types'
import { StickyExecutiveStrip } from '../../components/kpi/StickyExecutiveStrip'
import {
  ArrowLeft,
  Download,
  FileJson,
  LayoutDashboard,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { ImpactTab }      from './tabs/ImpactTab'
import { DriversTab }     from './tabs/DriversTab'
import { DiagnosticsTab } from './tabs/DiagnosticsTab'
import { LineageTab }     from './tabs/LineageTab'

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])
const IN_FLIGHT   = new Set(['queued','running','profiling','training','explaining','decisioning'])

type TabId = 'impact' | 'drivers' | 'diagnostics' | 'lineage'
const VALID_TABS = new Set<string>(['impact','drivers','diagnostics','lineage'])

const TABS = [
  { id: 'impact',      label: '1. Business Impact',    icon: LayoutDashboard },
  { id: 'drivers',     label: '2. Root Cause Drivers', icon: Target          },
  { id: 'diagnostics', label: '3. Trust Center',       icon: ShieldCheck     },
  { id: 'lineage',     label: '4. Lineage & Output',   icon: FileJson        },
] as const

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function statusTone(s: string): 'default'|'info'|'success'|'warning'|'risk' {
  if (s === 'completed') return 'success'
  if (s === 'completed_with_warnings') return 'warning'
  if (s === 'failed') return 'risk'
  if (IN_FLIGHT.has(s)) return 'warning'
  return 'default'
}

function fmt(iso: string | null) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

/* ─── AnalysisResult ─────────────────────────────────────────────────────── */
export function AnalysisResult() {
  const { id } = useParams<{ id: string }>()
  const analysisId = Number(id)

  // URL-synced tab state
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') ?? 'impact'
  const activeTab: TabId = VALID_TABS.has(rawTab) ? (rawTab as TabId) : 'impact'
  const setActiveTab = (tab: TabId) =>
    setSearchParams(prev => { prev.set('tab', tab); return prev }, { replace: true })

  // Export hub
  const [exportOpen, setExportOpen] = useState(false)

  // Heatmap column (preserved for future feature, kept local)
  const [heatmapColumn] = useState('')

  /* queries */
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: ['analysis', analysisId],
    queryFn:  async () => { const { data } = await api.get<Analysis>(`/analyses/${analysisId}`); return data },
    enabled:  Number.isFinite(analysisId),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return (s === 'completed' || s === 'failed') ? false : 2000
    },
  })

  const { data: datasetMeta } = useQuery({
    queryKey: ['dataset-columns', data?.dataset_id],
    queryFn:  async () => { const { data: d } = await api.get<Dataset>(`/datasets/${data!.dataset_id}`); return d },
    enabled:  Number.isFinite(analysisId) && !!data?.dataset_id && TERMINAL_OK.has(data.status),
  })

  useQuery({
    queryKey: ['risk-heatmap', analysisId, heatmapColumn],
    queryFn:  async () => {
      const { data: h } = await api.get<{ column: string; groups: unknown[] }>(
        `/analyses/${analysisId}/risk-by-column`, { params: { column: heatmapColumn } }
      )
      return h
    },
    enabled: Number.isFinite(analysisId) && !!heatmapColumn && !!data && TERMINAL_OK.has(data.status),
  })

  const { data: kpiHistory } = useQuery({
    queryKey: ['kpi-history', data?.dataset_id, data?.target],
    queryFn:  async () => {
      const { data: h } = await api.get<KpiHistoryResponse>(`/datasets/${data!.dataset_id}/kpi-history`, {
        params: { target: data!.target }
      })
      return h
    },
    enabled: Number.isFinite(analysisId) && !!data?.dataset_id && !!data?.target && TERMINAL_OK.has(data.status),
  })

  /* derived */
  const rawColumnNames = useMemo(
    () => datasetMeta?.columns?.map((c) => c.name) ?? [],
    [datasetMeta?.columns],
  )

  const directionByFeature = useMemo(() => {
    const m: Record<string, string> = {}
    if (!data) return m
    for (const r of data.report?.grouped_drivers ?? []) { if (r?.feature) m[r.feature] = r.direction }
    for (const r of data.shap_summary ?? [])            { if (r?.feature) m[r.feature] = r.direction }
    return m
  }, [data])

  /* download helpers */
  const downloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `analysis-${data.id}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadCsvSummary = () => {
    if (!data?.report?.kpis) return
    const k = data.report.kpis
    const rows: string[][] = [
      ['section','metric','value'],
      ['target','n_users',String(k.target_level.n_users)],
      ['target','target_rate',String(k.target_level.target_rate ?? '')],
      ['target','predicted_target_rate',String(k.target_level.predicted_target_rate ?? '')],
      ['target','high_risk_share',String(k.target_level.high_risk_share)],
      ['revenue','revenue_at_risk',String(k.impact_revenue?.revenue_at_risk ?? '')],
      ['concentration','gini',String(k.concentration.gini)],
      ['concentration','top_pct_users',String(k.concentration.headline.top_pct_users)],
      ['concentration','share_of_risk',String(k.concentration.headline.share_of_risk)],
      ['reliability','tier',k.reliability.tier],
      ['reliability','headline_metric',k.reliability.headline_metric],
      ['intervention','tier',k.intervention_confidence?.tier ?? ''],
      ['meta','pipeline_version',data.pipeline_version ?? ''],
      ['meta','analysis_created_at',data.created_at],
      ['drivers','top1',k.drivers[0] ? formatDriverLabel(k.drivers[0].feature, rawColumnNames) : ''],
      ['drivers','top1_share',String(k.drivers[0]?.share ?? '')],
    ]
    const esc  = (s: string) => `"${s.replace(/"/g,'""')}"`
    const body = rows.map(r => r.map(c => esc(String(c))).join(',')).join('\n')
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `analysis-${data.id}-summary.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  /* guards */
  if (!Number.isFinite(analysisId)) {
    return <Card padding="lg" tone="risk"><p className="text-sm font-medium">Invalid analysis id.</p></Card>
  }
  if (error) {
    return <ErrorState title="Could not load analysis" message="The report may not exist or the server returned an error." onRetry={() => void refetch()} />
  }
  if (isLoading || !data) {
    return (
      <SkeletonGroup label="Loading analysis results…">
        <div className="space-y-8 animate-fade-in-up">
          <div className="space-y-2">
            <SkeletonLine className="w-24 h-2" />
            <SkeletonLine className="w-64 h-7" />
            <SkeletonLine className="w-48 h-3" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <SkeletonStat key={i} />)}
          </div>
          <SkeletonBlock className="h-64 w-full" />
          <SkeletonBlock className="h-80 w-full" />
        </div>
      </SkeletonGroup>
    )
  }

  const running  = IN_FLIGHT.has(data.status)
  const finalOk  = TERMINAL_OK.has(data.status)
  const kpis     = data.report?.kpis
  const revenueReady = !!(kpis?.impact_revenue && data.value_column)

  return (
    <div data-analysis-result className="space-y-8 animate-fade-in-up pb-20">

      {/* ── Back + Page header ── */}
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
                <StatusBadge tone="info">{data.task_type.replace('_',' ')}</StatusBadge>
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
                to={`/analyses/compare?ids=${data.id},`}
              >
                Compare runs
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setExportOpen(true)}
                className="print:hidden"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </>
          }
        />
      </div>

      {/* ── Sticky Executive Strip ── */}
      {finalOk && kpis && (
        <StickyExecutiveStrip
          detail={data}
          kpis={kpis}
          history={kpiHistory}
          rawColumns={rawColumnNames}
        />
      )}

      {/* ── Run metadata strip ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Run id"   value={`#${data.id}`}                              hint="Persistent identifier" />
        <Stat label="Status"  value={<span className="capitalize">{data.status}</span>} tone={statusTone(data.status)} />
        <Stat label="Created"   value={fmt(data.created_at)} />
        <Stat label="Completed" value={fmt(data.completed_at)} />
      </div>

      {/* ── Failed banner ── */}
      {data.status === 'failed' && (
        <ErrorState
          title="Analysis Failed"
          message={data.error || data.report?.user_message || 'An error occurred during analysis.'}
          onRetry={() => void refetch()}
          retryLabel="Refresh status"
        />
      )}

      {/* Export Hub */}
      <ExportHub
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        analysisId={data.id}
        onDownloadCsv={downloadCsvSummary}
        onDownloadJson={downloadJson}
        onPrint={() => window.print()}
        canExport={finalOk}
      />

      {/* Tabbed content (only when completed) */}
      {finalOk && kpis && (
        <>
          {/* Tab bar */}
          <div
            className="sticky top-[var(--app-header-height)] z-30 -mx-4 px-4 sm:mx-0 sm:px-0 py-3
                       bg-[var(--app-bg)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] print:hidden"
          >
            <nav className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Analysis sections">
              {TABS.map(tab => {
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`tabpanel-${tab.id}`}
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

          {/* Tab panels */}
          <div className="mt-8 print:block" key={activeTab}>
            <div
              id={`tabpanel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === 'impact' && (
                <ImpactTab data={data} kpis={kpis} rawColumnNames={rawColumnNames} />
              )}
              {activeTab === 'drivers' && (
                <DriversTab
                  data={data}
                  kpis={kpis}
                  directionByFeature={directionByFeature}
                  rawColumnNames={rawColumnNames}
                  revenueReady={revenueReady}
                />
              )}
              {activeTab === 'diagnostics' && (
                <DiagnosticsTab data={data} />
              )}
              {activeTab === 'lineage' && (
                <LineageTab data={data} onDownloadJson={downloadJson} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
