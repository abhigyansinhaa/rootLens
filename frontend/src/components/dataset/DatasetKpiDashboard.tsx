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
} from '../ui'
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

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'risk'
  if (status === 'queued' || status === 'running') return 'warning'
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
      const { data } = await api.get<AnalysisListItem[]>(`/datasets/${datasetId}/analyses`)
      return data
    },
    enabled: Number.isFinite(datasetId),
    refetchInterval: (q) => {
      const rows = q.state.data ?? []
      const pending = rows.some((r) => r.status === 'queued' || r.status === 'running')
      return pending ? 2000 : false
    },
  })

  const [selectedId, setSelectedId] = useState<number | null>(null)

  const defaultAnalysisId = useMemo(() => {
    if (!analysesQuery.data?.length) return null
    const completed = analysesQuery.data.find((a) => a.status === 'completed')
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
      if (s === 'completed' || s === 'failed') return false
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
      <section id="dataset-kpi-dashboard" className="space-y-4">
        <SectionHeader
          eyebrow="Analysis dashboard"
          title={datasetName ? `Runs for ${datasetName}` : 'Analysis dashboard'}
          description="Start a root-cause analysis above. When a run finishes, open the dedicated result page for KPIs, drivers, metrics, and recommendations."
        />
        <Card padding="lg" tone="info">
          <CardTitle className="text-lg">No analyses yet</CardTitle>
          <CardDescription>
            Pick a target column and run an analysis. You’ll be taken to the result page while the job runs; return
            here anytime to switch runs or check status.
          </CardDescription>
        </Card>
      </section>
    )
  }

  return (
    <section id="dataset-kpi-dashboard" className="space-y-8">
      <SectionHeader
        eyebrow="Analysis dashboard"
        title={datasetName ? `Runs for ${datasetName}` : 'Analysis dashboard'}
        description="Monitor queued and in-flight jobs and jump to the full report for any completed run."
      />

      <Card padding="md" tone="strong" elevated>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Select
            label="Analysis focus"
            id="dataset-analysis-select"
            value={activeAnalysisId ?? ''}
            onChange={(e) => {
              const next = Number(e.target.value)
              setSelectedId(Number.isFinite(next) ? next : null)
            }}
          >
            {analyses.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} - {a.target} ({a.status}) - {formatDate(a.created_at)}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            {detail && (
              <StatusBadge tone={statusTone(detail.status)} dot>
                {detail.status}
              </StatusBadge>
            )}
            {detail && detail.status === 'completed' && (
              <Button variant="secondary" size="sm" to={`/analyses/${detail.id}`}>
                Open result page
              </Button>
            )}
          </div>
        </div>
      </Card>

      {detailQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : detail?.status === 'completed' ? (
        <Card padding="lg" tone="success" elevated>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Analysis complete</CardTitle>
              <CardDescription className="mt-2">
                Target{' '}
                <code className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 font-mono text-xs">{detail.target}</code>
                {detail.task_type && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="capitalize">{detail.task_type.replace('_', ' ')}</span>
                  </>
                )}
                . Full KPIs, segment charts, feature drivers, model metrics, SHAP plots, insights, and recommendations
                are on the result page.
              </CardDescription>
            </div>
            <Button to={`/analyses/${detail.id}`}>Open result page</Button>
          </div>
        </Card>
      ) : (
        <Card padding="lg" tone={detail?.status === 'failed' ? 'risk' : 'warning'} elevated>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                {detail?.status === 'failed' ? 'Analysis needs attention' : 'Analysis is preparing results'}
              </CardTitle>
              <CardDescription>
                {detail?.error ||
                  detail?.report?.user_message ||
                  'When this job finishes, open the result page for the full report.'}
              </CardDescription>
            </div>
            {detail && <StatusBadge tone={statusTone(detail.status)}>{detail.status}</StatusBadge>}
          </div>
        </Card>
      )}
    </section>
  )
}
