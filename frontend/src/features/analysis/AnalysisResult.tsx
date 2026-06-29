import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, useRef, useCallback } from 'react'
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
  StatusBadge,
  AICopilot,
  AICopilotFab,
  AICopilotSheet,
  PipelineStatusIndicator,
} from '../../components/ui'
import { ExportHub } from '../../components/ExportHub'
import { formatDriverLabel } from '../../lib/driverLabels'
import type { Analysis, Dataset, KpiHistoryResponse } from '../../types'
import { StickyExecutiveStrip } from '../../components/kpi/StickyExecutiveStrip'
import { TrustAccordion } from '../../components/kpi/TrustAccordion'
import { DecisionBriefPrint } from '../../components/kpi/DecisionBriefPrint'
import { useAnalysisKeyboard, scrollToSection } from '../../hooks/useAnalysisKeyboard'
import { ArrowLeft, Download, FileJson, ShieldCheck, Sparkles, X } from 'lucide-react'
import { ImpactTab } from './tabs/ImpactTab'
import { DriversTab } from './tabs/DriversTab'
import { DiagnosticsTab } from './tabs/DiagnosticsTab'
import { LineageTab } from './tabs/LineageTab'

const TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])
const IN_FLIGHT = new Set(['queued', 'running', 'profiling', 'training', 'explaining', 'decisioning'])

const TABS = [
  { id: 'diagnostics', label: 'Diagnostics', icon: ShieldCheck },
  { id: 'lineage', label: 'Lineage', icon: FileJson },
] as const

function statusTone(s: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (s === 'completed') return 'success'
  if (s === 'completed_with_warnings') return 'warning'
  if (s === 'failed') return 'risk'
  if (IN_FLIGHT.has(s)) return 'warning'
  return 'default'
}

function fmt(iso: string | null) {
  if (!iso) return '—'
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

function analysisTitle(data: Analysis, datasetName?: string) {
  const target = data.target.replace(/_/g, ' ')
  if (datasetName) return `${datasetName} · ${target}`
  return `${target.charAt(0).toUpperCase()}${target.slice(1)} analysis`
}

export function AnalysisResult() {
  const [highlightedDriver, setHighlightedDriver] = useState<string | null>(null)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const driverSearchRef = useRef<HTMLInputElement>(null)
  const { id } = useParams<{ id: string }>()
  const analysisId = Number(id)

  const [searchParams, setSearchParams] = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  const rawTab = searchParams.get('tab') ?? 'diagnostics'
  const activeTabUrl = rawTab === 'lineage' ? 'lineage' : 'diagnostics'
  const setActiveTabUrl = (tab: 'diagnostics' | 'lineage') =>
    setSearchParams((prev) => {
      prev.set('tab', tab)
      return prev
    }, { replace: true })

  const { data, error, refetch, isLoading } = useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const { data: d } = await api.get<Analysis>(`/analyses/${analysisId}`)
      return d
    },
    enabled: Number.isFinite(analysisId),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'completed' || s === 'failed' ? false : 2000
    },
  })

  const { data: datasetMeta } = useQuery({
    queryKey: ['dataset-columns', data?.dataset_id],
    queryFn: async () => {
      const { data: d } = await api.get<Dataset>(`/datasets/${data!.dataset_id}`)
      return d
    },
    enabled: Number.isFinite(analysisId) && !!data?.dataset_id && TERMINAL_OK.has(data.status),
  })

  const { data: kpiHistory } = useQuery({
    queryKey: ['kpi-history', data?.dataset_id, data?.target],
    queryFn: async () => {
      const { data: h } = await api.get<KpiHistoryResponse>(`/datasets/${data!.dataset_id}/kpi-history`, {
        params: { target: data!.target },
      })
      return h
    },
    enabled: Number.isFinite(analysisId) && !!data?.dataset_id && !!data?.target && TERMINAL_OK.has(data.status),
  })

  const rawColumnNames = useMemo(
    () => datasetMeta?.columns?.map((c) => c.name) ?? [],
    [datasetMeta?.columns],
  )

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

  const handleCopilotAction = useCallback(
    (action: string) => {
      if (action === 'what-if') scrollToSection('impact-section')
      else if (action === 'decision-brief') window.print()
      else if (action === 'export-segment') setExportOpen(true)
    },
    [],
  )

  useAnalysisKeyboard({
    onOpenCopilot: () => setCopilotOpen(true),
    onFocusSearch: () => driverSearchRef.current?.focus(),
    enabled: !!data && TERMINAL_OK.has(data.status),
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
        <p className="text-sm font-medium">Invalid analysis id.</p>
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
    return (
      <SkeletonGroup label="Loading analysis results…">
        <div className="space-y-8 animate-fade-in-up">
          <div className="space-y-2">
            <SkeletonLine className="w-24 h-2" />
            <SkeletonLine className="w-64 h-7" />
            <SkeletonLine className="w-48 h-3" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonStat key={i} />
            ))}
          </div>
          <SkeletonBlock className="h-64 w-full" />
          <SkeletonBlock className="h-80 w-full" />
        </div>
      </SkeletonGroup>
    )
  }

  const running = IN_FLIGHT.has(data.status)
  const finalOk = TERMINAL_OK.has(data.status)
  const kpis = data.report?.kpis
  const revenueReady = !!(kpis?.impact_revenue && data.value_column)
  const rel = kpis?.reliability
  const trustSummary = rel
    ? `Reliability ${rel.tier} · ${rel.headline_metric} ${rel.headline_value?.toFixed?.(2) ?? rel.headline_value} · Pipeline ${data.pipeline_version ?? '—'}`
    : 'Model governance and audit metadata'

  const copilotProps = kpis
    ? {
      analysis: data,
      kpis,
      rawColumns: rawColumnNames,
      highlightedDriver,
      onDriverHover: setHighlightedDriver,
      onCitationClick: scrollToSection,
      onAction: handleCopilotAction,
    }
    : null

  return (
    <div data-analysis-result className="space-y-10 animate-fade-in-up pb-24">
      {finalOk && kpis && (
        <DecisionBriefPrint
          analysis={data}
          kpis={kpis}
          datasetName={datasetMeta?.name}
          rawColumns={rawColumnNames}
        />
      )}

      {isDemo && finalOk && (
        <div className="print:hidden rounded-lg bg-(--brand-dim) px-4 py-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-(--brand) shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-(--text-1)">Investor demo mode</p>
              <p className="text-xs text-(--text-2) mt-0.5">
                Tier 1 metrics → concentration → drivers → trust center. Press <kbd className="px-1 rounded bg-(--surface-2)">c</kbd> for analyst.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                p.delete('demo')
                return p
              }, { replace: true })
            }
            className="text-(--text-3) hover:text-(--text-1)"
            aria-label="Dismiss demo banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Link
          className="print:hidden inline-flex items-center gap-2 text-sm font-medium text-(--text-3) hover:text-(--brand) transition-colors"
          to={`/datasets/${data.dataset_id}`}
        >
          <ArrowLeft className="h-4 w-4" /> Back to {datasetMeta?.name ?? 'dataset'}
        </Link>

        <PageHeader
          eyebrow="Analysis"
          title={analysisTitle(data, datasetMeta?.name)}
          description="Decision-ready root cause report with monetized impact and governance signals."
          meta={
            <>
              <StatusBadge tone={statusTone(data.status)} dot>
                {running ? `${data.status}…` : data.status}
              </StatusBadge>
              {data.task_type && <StatusBadge tone="info">{data.task_type.replace('_', ' ')}</StatusBadge>}
              <span className="text-xs text-(--text-3)">
                Run #{data.id} · {fmt(data.completed_at ?? data.created_at)}
              </span>
              {data.target && (
                <span className="text-xs font-medium text-(--text-2)">
                  Target: <span className="text-(--text-1)">{data.target}</span>
                </span>
              )}
            </>
          }
          actions={
            <>
              <Button variant="secondary" size="sm" className="print:hidden" to={`/analyses/compare?ids=${data.id},`}>
                Compare
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => setExportOpen(true)} className="print:hidden">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </>
          }
        />
      </div>

      {running && (
        <PipelineStatusIndicator status={data.status} />
      )}

      {finalOk && kpis && (
        <StickyExecutiveStrip
          detail={data}
          kpis={kpis}
          history={kpiHistory}
          rawColumns={rawColumnNames}
          onExport={() => setExportOpen(true)}
        />
      )}

      {data.status === 'failed' && (
        <ErrorState
          title="Analysis failed"
          message={data.error || data.report?.user_message || 'An error occurred during analysis.'}
          onRetry={() => void refetch()}
          retryLabel="Refresh status"
        />
      )}

      <ExportHub
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        analysisId={data.id}
        onDownloadCsv={downloadCsvSummary}
        onDownloadJson={downloadJson}
        onPrint={() => window.print()}
        onDecisionBrief={() => window.print()}
        canExport={finalOk}
      />

      {finalOk && kpis && (
        <div className="lg:flex lg:gap-10 lg:items-start print:block">
          <div className="flex-1 space-y-16 min-w-0">
            <section id="impact-section" className="scroll-mt-28 section-anchor">
              <ImpactTab data={data} kpis={kpis} rawColumnNames={rawColumnNames} kpiHistory={kpiHistory} />
            </section>

            <section id="drivers-section-root" className="scroll-mt-28 section-anchor">
              <h2 className="text-lg font-semibold text-(--text-1) mb-8">Root cause drivers</h2>
              <DriversTab
                data={data}
                kpis={kpis}
                directionByFeature={directionByFeature}
                rawColumnNames={rawColumnNames}
                revenueReady={revenueReady}
                highlightedDriver={highlightedDriver}
                onDriverHover={setHighlightedDriver}
                onHighlightChange={setHighlightedDriver}
                driverSearchRef={driverSearchRef}
              />
            </section>

            <TrustAccordion summary={trustSummary} defaultOpen={false}>
              <nav className="flex items-center gap-2 overflow-x-auto mb-6" role="tablist">
                {TABS.map((tab) => {
                  const active = activeTabUrl === tab.id
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTabUrl(tab.id)}
                      className={[
                        'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                        active ? 'bg-(--brand-dim) text-(--brand)' : 'text-(--text-3) hover:bg-(--surface-2) hover:text-(--text-1)',
                      ].join(' ')}
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
              {activeTabUrl === 'diagnostics' && <DiagnosticsTab data={data} />}
              {activeTabUrl === 'lineage' && <LineageTab data={data} onDownloadJson={downloadJson} />}
            </TrustAccordion>
          </div>

          {copilotProps && (
            <aside className="hidden xl:block w-80 shrink-0 sticky top-[calc(var(--app-header-height)+52px)] self-start max-h-[calc(100vh-var(--app-header-height)-64px)]">
              <div
                className="rounded-lg bg-(--surface-1) p-5 flex flex-col max-h-[inherit] border border-(--border-subtle)"
              >
                <AICopilot {...copilotProps} className="min-h-[480px]" />
              </div>
            </aside>
          )}
        </div>
      )}

      {copilotProps && (
        <>
          <AICopilotFab onClick={() => setCopilotOpen(true)} />
          <AICopilotSheet open={copilotOpen} onClose={() => setCopilotOpen(false)}>
            <div className="relative flex flex-col max-h-[80vh] overflow-hidden">
              <AICopilot {...copilotProps} mobileOpen onMobileClose={() => setCopilotOpen(false)} />
            </div>
          </AICopilotSheet>
        </>
      )}
    </div>
  )
}
