import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  LoadingState,
  SectionHeader,
  Select,
  StatusBadge,
} from '../../components/ui'
import { Activity, PlayCircle, AlertCircle, CheckCircle2, ChevronRight, BarChart3 } from 'lucide-react'
import type { Analysis, AnalysisListItem } from '../../types'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

const DKD_IN_FLIGHT = new Set([
  'queued',
  'running',
  'profiling',
  'training',
  'explaining',
  'decisioning',
])
const DKD_TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed') return 'risk'
  if (DKD_IN_FLIGHT.has(status)) return 'warning'
  return 'default'
}

type Props = {
  datasetId: number
  datasetName?: string
}

export function DatasetKpiDashboard({ datasetId, datasetName }: Props) {
  const analysesQuery = useQuery({
    queryKey: ['datasetAnalyses', datasetId],
    queryFn: async () => {
      const { data } = await api.get<AnalysisListItem[]>(`/datasets/${datasetId}/analyses`, {
        params: { limit: 100 },
      })
      return data
    },
    enabled: Number.isFinite(datasetId),
    refetchInterval: (q) => {
      const rows = q.state.data ?? []
      const pending = rows.some((r) => DKD_IN_FLIGHT.has(r.status))
      return pending ? 2000 : false
    },
  })

  const [selectedId, setSelectedId] = useState<number | null>(null)

  const defaultAnalysisId = useMemo(() => {
    if (!analysesQuery.data?.length) return null
    const completed = analysesQuery.data.find((a) => DKD_TERMINAL_OK.has(a.status))
    return (completed ?? analysesQuery.data[0])?.id ?? null
  }, [analysesQuery.data])

  const activeAnalysisId = selectedId ?? defaultAnalysisId

  const detailQuery = useQuery({
    queryKey: ['analysis', activeAnalysisId],
    queryFn: async () => {
      const { data } = await api.get<Analysis>(`/analyses/${activeAnalysisId}`)
      return data
    },
    enabled: activeAnalysisId != null,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      if (s === 'completed' || s === 'completed_with_warnings' || s === 'failed') return false
      return 2000
    },
  })

  const analyses = analysesQuery.data ?? []
  const detail = detailQuery.data

  if (analysesQuery.isLoading) {
    return <LoadingState rows={3} message="Loading analyses…" />
  }

  if (!analyses.length) {
    return (
      <section id="dataset-kpi-dashboard" className="space-y-4 animate-fade-in-up">
        <SectionHeader
          eyebrow="Analysis Dashboard"
          title={datasetName ? `Runs for ${datasetName}` : 'Analysis dashboard'}
          description="Start a root-cause analysis above. When a run finishes, open the dedicated result page for KPIs, drivers, metrics, and recommendations."
        />
        <Card padding="xl" className="border-dashed border-2 bg-[var(--surface-2)]/30 text-center">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-[var(--text-3)]" />
          <CardTitle className="text-xl">No analyses yet</CardTitle>
          <CardDescription className="mt-2 max-w-md mx-auto">
            Pick a target column and run an analysis. You’ll be taken to the result page while the job runs; return
            here anytime to switch runs or check status.
          </CardDescription>
        </Card>
      </section>
    )
  }

  return (
    <section id="dataset-kpi-dashboard" className="space-y-6 animate-fade-in-up">
      <SectionHeader
        eyebrow="Analysis Dashboard"
        title={datasetName ? `Runs for ${datasetName}` : 'Analysis dashboard'}
        description="Monitor queued and in-flight jobs and jump to the full report for any completed run."
        actions={
          <Button variant="secondary" size="sm" to={`/datasets/${datasetId}`}>
            View dataset
          </Button>
        }
      />

      <Card padding="md" tone="strong" elevated className="glass border-t-[var(--border-subtle)] border-t-2">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <Activity className="h-5 w-5 text-brand-500 hidden sm:block" />
            <Select
              label="Analysis focus"
              id="dataset-analysis-select"
              value={activeAnalysisId ?? ''}
              className="bg-[var(--surface-1)] transition-colors focus:ring-brand-500 w-full sm:w-96"
              onChange={(e) => {
                const next = Number(e.target.value)
                setSelectedId(Number.isFinite(next) ? next : null)
              }}
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  Run #{a.id} • Target: {a.target} ({a.status}) • {formatDate(a.created_at)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {detail && (
              <StatusBadge tone={statusTone(detail.status)} dot className="scale-95">
                {detail.status}
              </StatusBadge>
            )}
            {detail && DKD_TERMINAL_OK.has(detail.status) && (
              <Button size="sm" className="bg-brand-500 hover:bg-brand-400 text-white shadow-md shadow-brand-500/20" to={`/analyses/${detail.id}`}>
                View Report <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {detailQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : detail && DKD_TERMINAL_OK.has(detail.status) ? (
        <Card padding="lg" elevated className={`border-l-4 ${detail.status === 'completed_with_warnings' ? 'border-l-amber-500 bg-amber-500/5' : 'border-l-emerald-500 bg-emerald-500/5'} animate-slide-in-left`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className={`mt-1 flex shrink-0 h-10 w-10 items-center justify-center rounded-full ${detail.status === 'completed_with_warnings' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'}`}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {detail.status === 'completed_with_warnings'
                    ? 'Analysis complete (with warnings)'
                    : 'Analysis complete'}
                </CardTitle>
                <CardDescription className="mt-2 text-[var(--text-2)] max-w-2xl">
                  Target <code className="rounded bg-[var(--surface-2)] border border-[var(--border-subtle)] px-1.5 py-0.5 font-mono text-xs font-bold text-[var(--text-1)]">{detail.target}</code>
                  {detail.task_type && (
                    <>
                      {' '}•{' '}
                      <span className="capitalize font-medium">{detail.task_type.replace('_', ' ')}</span>
                    </>
                  )}
                  . Full KPIs, segment charts, feature drivers, model metrics, SHAP plots, insights, and recommendations
                  are available on the result page.
                </CardDescription>
              </div>
            </div>
            <Button className="shrink-0 bg-[var(--text-1)] text-[var(--app-bg)] hover:bg-[var(--text-2)] shadow-lg" to={`/analyses/${detail.id}`}>
              Open Result Page
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="lg" elevated className={`border-l-4 ${detail?.status === 'failed' ? 'border-l-red-500 bg-red-500/5' : 'border-l-brand-500 bg-brand-500/5'} animate-slide-in-left`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className={`mt-1 flex shrink-0 h-10 w-10 items-center justify-center rounded-full ${detail?.status === 'failed' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-brand-100 text-brand-600 dark:bg-brand-900/30'}`}>
                {detail?.status === 'failed' ? <AlertCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5 animate-pulse" />}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {detail?.status === 'failed' ? 'Analysis needs attention' : 'Analysis is preparing results'}
                </CardTitle>
                <CardDescription className="mt-1 text-[var(--text-2)] max-w-xl">
                  {detail?.error ||
                    detail?.report?.user_message ||
                    'When this job finishes, open the result page for the full report. You can safely navigate away.'}
                </CardDescription>
              </div>
            </div>
            {detail && <StatusBadge tone={statusTone(detail.status)} className="shrink-0">{detail.status}</StatusBadge>}
          </div>
        </Card>
      )}
    </section>
  )
}
