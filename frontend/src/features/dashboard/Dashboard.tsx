import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { KpiCard } from '../../components/kpi'
import { formatPct01 } from '../../components/kpi/format'
import { api } from '../../api/client'
import {
  Button,
  Card,
  CardEyebrow,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionHeader,
  StatusBadge,
} from '../../components/ui'
import type { AnalysisListItem, Dataset } from '../../types'

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

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const DASHBOARD_IN_FLIGHT = new Set([
  'queued',
  'running',
  'profiling',
  'training',
  'explaining',
  'decisioning',
])
const DASHBOARD_TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed') return 'risk'
  if (DASHBOARD_IN_FLIGHT.has(status)) return 'warning'
  return 'default'
}

export function Dashboard() {
  const datasetsQuery = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const { data } = await api.get<Dataset[]>('/datasets', { params: { limit: 500 } })
      return data
    },
  })

  const analysesQuery = useQuery({
    queryKey: ['analyses'],
    queryFn: async () => {
      const { data } = await api.get<AnalysisListItem[]>('/analyses', { params: { limit: 200 } })
      return data
    },
  })

  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data])
  const analyses = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data])
  const datasetCount = datasets.length
  const totalRows = datasets.reduce((s, d) => s + d.rows, 0)
  const completedAnalyses = analyses.filter((a) => DASHBOARD_TERMINAL_OK.has(a.status)).length
  const failedAnalyses = analyses.filter((a) => a.status === 'failed').length
  const inFlightAnalyses = analyses.filter((a) => DASHBOARD_IN_FLIGHT.has(a.status)).length

  const recent = useMemo(
    () =>
      [...datasets]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [datasets],
  )

  const latestByDataset = useMemo(() => {
    const map = new Map<number, AnalysisListItem>()
    for (const a of analyses) {
      const existing = map.get(a.dataset_id)
      if (!existing || new Date(a.created_at).getTime() > new Date(existing.created_at).getTime()) {
        map.set(a.dataset_id, a)
      }
    }
    return map
  }, [analyses])

  const recentRuns = useMemo(
    () =>
      [...analyses]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [analyses],
  )

  const priorityQueue = useMemo(() => {
    const items: { dataset: Dataset; reason: string; tone: 'risk' | 'warning' | 'info' }[] = []
    for (const ds of datasets) {
      const latest = latestByDataset.get(ds.id)
      if (!latest) {
        items.push({ dataset: ds, reason: 'No analysis yet', tone: 'warning' })
      } else if (latest.status === 'failed') {
        items.push({ dataset: ds, reason: 'Last run failed - retry', tone: 'risk' })
      } else if (DASHBOARD_IN_FLIGHT.has(latest.status)) {
        items.push({ dataset: ds, reason: 'Run in progress', tone: 'info' })
      }
    }
    return items.slice(0, 4)
  }, [datasets, latestByDataset])

  const listError =
    datasetsQuery.error || analysesQuery.error
      ? "We couldn't load workspace metadata. Retry after confirming login and API uptime."
      : null

  if (datasetsQuery.isLoading || analysesQuery.isLoading) {
    return <LoadingState rows={4} />
  }

  if (listError) {
    return (
      <ErrorState
        message={listError}
        onRetry={() => {
          void datasetsQuery.refetch()
          void analysesQuery.refetch()
        }}
      />
    )
  }

  if (!datasetCount && !analyses.length) {
    return (
      <EmptyState
        title="Start your RCA workspace"
        description="Upload a CSV or Parquet dataset, select a target, and turn model output into business decisions."
        action={<Button to="/upload">Upload dataset</Button>}
      />
    )
  }

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Command center"
        title="Workspace cockpit"
        description="Workspace overview only. Open a dataset for target rates, risk segments, drivers, and revenue impact tied to that data."
        meta={
          <>
            <StatusBadge tone="success" dot>
              API healthy
            </StatusBadge>
            <StatusBadge tone="info">{`${datasetCount.toLocaleString()} datasets`}</StatusBadge>
            <StatusBadge tone={inFlightAnalyses ? 'warning' : 'default'} dot={inFlightAnalyses > 0}>
              {inFlightAnalyses ? `${inFlightAnalyses} runs in flight` : 'No runs in flight'}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button to="/upload">Upload dataset</Button>
            <Button to="/datasets" variant="secondary">
              Manage datasets
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          tone="brand"
          label="Datasets indexed"
          value={datasetCount.toLocaleString()}
          hint={`${totalRows.toLocaleString()} rows under coverage`}
        />
        <KpiCard
          tone="default"
          label="Tracked analyses"
          value={analyses.length.toLocaleString()}
          hint={`${completedAnalyses} decision-ready · ${failedAnalyses} need attention`}
        />
        <KpiCard
          tone="emerald"
          label="Completion rate"
          value={analyses.length ? formatPct01(completedAnalyses / analyses.length, 0) : '0%'}
          hint="Completed analyses divided by all runs"
        />
        <KpiCard
          tone={priorityQueue.length ? 'amber' : 'default'}
          label="Awaiting decision"
          value={priorityQueue.length.toLocaleString()}
          hint={priorityQueue.length ? 'Datasets needing operator action' : 'Queue is clear'}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <Card padding="lg" tone="strong">
          <SectionHeader
            eyebrow="Action agenda"
            title="Datasets that need attention"
            description="Where the cockpit recommends operator action next."
            actions={
              <Button variant="secondary" size="sm" to="/datasets">
                Open inventory
              </Button>
            }
          />
          {priorityQueue.length ? (
            <ul className="mt-5 divide-y divide-[var(--border-1)]">
              {priorityQueue.map(({ dataset, reason, tone }) => (
                <li key={dataset.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    to={`/datasets/${dataset.id}`}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--surface-3)]/60"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--text-1)]">{dataset.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-3)]">
                        {dataset.rows.toLocaleString()} rows · {dataset.cols} cols · uploaded{' '}
                        {formatDate(dataset.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={tone} dot>
                        {reason}
                      </StatusBadge>
                      <span
                        aria-hidden
                        className="text-[var(--text-3)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text-1)]"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-[var(--border-1)] bg-[var(--surface-3)]/50 p-4 text-sm text-[var(--text-2)]">
              No outstanding items - every dataset has a recent run. Open one to drill into business KPIs.
            </p>
          )}
        </Card>

        <Card padding="lg" tone="strong">
          <SectionHeader eyebrow="Recent runs" title="Latest analyses" />
          {recentRuns.length ? (
            <ul className="mt-5 space-y-3">
              {recentRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    to={`/analyses/${run.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-3 transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-3)]/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--text-1)]">
                        {run.dataset_name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-3)]">
                        target {run.target} · {formatDateTime(run.created_at)}
                      </p>
                    </div>
                    <StatusBadge tone={statusTone(run.status)} dot>
                      {run.status}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-[var(--border-1)] bg-[var(--surface-3)]/50 p-4 text-sm text-[var(--text-2)]">
              No runs yet. Upload a dataset to begin.
            </p>
          )}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card padding="lg" tone="strong">
          <SectionHeader eyebrow="Workflow" title="RCA in three moves" />
          <ol className="mt-5 space-y-4">
            {[
              {
                step: '01',
                title: 'Upload',
                body: 'Bring in CSV or Parquet tables with targets and optional value fields.',
              },
              {
                step: '02',
                title: 'Analyze',
                body: 'Pick the target on a dataset and let the model produce drivers, SHAP, and KPI rollups.',
              },
              {
                step: '03',
                title: 'Act',
                body: 'Open the dataset to review business KPIs and prioritize the riskiest, most tractable segments.',
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-4">
                <span className="font-mono text-sm font-black text-brand-600 dark:text-brand-300">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-[var(--text-1)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card padding="lg">
          <div className="flex items-end justify-between gap-4">
            <div>
              <CardEyebrow>Inventory</CardEyebrow>
              <CardTitle className="mt-2 text-lg">Recently added datasets</CardTitle>
              <p className="mt-1 text-sm text-[var(--text-2)]">Open one to see its KPI dashboard.</p>
            </div>
            <Button variant="secondary" size="sm" to="/datasets">
              View all
            </Button>
          </div>
          {recent.length ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {recent.map((dataset) => {
                const latest = latestByDataset.get(dataset.id)
                return (
                  <li key={dataset.id}>
                    <Link
                      to={`/datasets/${dataset.id}#dataset-kpi-dashboard`}
                      className="block rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-3)]/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-bold text-[var(--text-1)]">{dataset.name}</span>
                        {latest && (
                          <StatusBadge tone={statusTone(latest.status)} dot>
                            {latest.status}
                          </StatusBadge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-2)] tabular-nums">
                        {dataset.rows.toLocaleString()} rows · {dataset.cols} cols
                      </p>
                      <p className="mt-3 text-[11px] font-medium text-[var(--text-3)]">
                        {latest
                          ? `Latest run #${latest.id} on ${formatDate(latest.created_at)}`
                          : `Uploaded ${formatDate(dataset.created_at)} · no runs yet`}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-[var(--text-2)]">No datasets yet. Upload one to get started.</p>
          )}
        </Card>
      </section>
    </div>
  )
}
