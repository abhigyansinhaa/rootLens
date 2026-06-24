import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { formatPct01 } from '../../components/kpi/format'
import {
  Button,
  EmptyState,
  ErrorState,
  StatusBadge,
  NumberTicker,
} from '../../components/ui'
import { DashboardSkeleton } from '../../components/PageSkeletons'
import {
  ArrowRight, Clock, PlayCircle,
  PlusCircle, AlertCircle, ArrowUpRight,
  Database, BarChart3, Activity,
} from 'lucide-react'
import type { AnalysisListItem, Dataset } from '../../types'

/* ─── helpers ─── */
function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return iso }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const IN_FLIGHT = new Set(['queued', 'running', 'profiling', 'training', 'explaining', 'decisioning'])
const TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed') return 'risk'
  if (IN_FLIGHT.has(status)) return 'warning'
  return 'default'
}

/* ─── Micro sparkline ─── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const w = 64, h = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="overflow-visible opacity-60" style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Dashboard ─── */
export function Dashboard() {
  const datasetsQuery = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => { const { data } = await api.get<Dataset[]>('/datasets', { params: { limit: 500 } }); return data },
  })
  const analysesQuery = useQuery({
    queryKey: ['analyses'],
    queryFn: async () => { const { data } = await api.get<AnalysisListItem[]>('/analyses', { params: { limit: 200 } }); return data },
  })

  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data])
  const analyses = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data])
  const completed = analyses.filter(a => TERMINAL_OK.has(a.status)).length
  const totalRows = datasets.reduce((s, d) => s + d.rows, 0)

  const recent = useMemo(
    () => [...datasets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [datasets],
  )

  const latestByDataset = useMemo(() => {
    const map = new Map<number, AnalysisListItem>()
    for (const a of analyses) {
      const ex = map.get(a.dataset_id)
      if (!ex || new Date(a.created_at).getTime() > new Date(ex.created_at).getTime())
        map.set(a.dataset_id, a)
    }
    return map
  }, [analyses])

  const recentRuns = useMemo(
    () => [...analyses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [analyses],
  )

  const actionQueue = useMemo(() => {
    const items: { dataset: Dataset; reason: string; tone: 'risk' | 'warning' | 'info'; icon: React.ElementType }[] = []
    for (const ds of datasets) {
      const latest = latestByDataset.get(ds.id)
      if (!latest) items.push({ dataset: ds, reason: 'Requires initial analysis', tone: 'warning', icon: AlertCircle })
      else if (latest.status === 'failed') items.push({ dataset: ds, reason: 'Last run failed — review needed', tone: 'risk', icon: AlertCircle })
      else if (IN_FLIGHT.has(latest.status)) items.push({ dataset: ds, reason: 'Analysis in progress', tone: 'info', icon: PlayCircle })
    }
    return items.slice(0, 4)
  }, [datasets, latestByDataset])

  if (datasetsQuery.isLoading || analysesQuery.isLoading)
    return <DashboardSkeleton />

  if (datasetsQuery.error || analysesQuery.error)
    return <ErrorState message="We couldn't load workspace data. Retry after confirming login and API uptime." onRetry={() => { datasetsQuery.refetch(); analysesQuery.refetch() }} />

  if (!datasets.length && !analyses.length)
    return (
      <EmptyState
        title="Start your RootLens workspace"
        description="Upload a CSV or Parquet dataset, select a target column, and turn model outputs into decisions."
        action={
          <div className="flex items-center gap-3">
            <Button to="/upload"><PlusCircle className="h-4 w-4" /> Upload dataset</Button>
            <Button variant="secondary" to="/upload?demo=true">Try demo data</Button>
          </div>
        }
      />
    )

  const kpis = [
    { label: 'Indexed Datasets', value: datasets.length, hint: `${totalRows.toLocaleString()} rows total`, color: 'var(--brand)', spark: [2, 4, 3, 6, 8, 12, datasets.length], icon: Database },
    { label: 'Total Analyses', value: analyses.length, hint: `${completed} completed`, color: 'var(--c-info)', spark: [1, 3, 5, 4, 7, 9, analyses.length], icon: BarChart3 },
    { label: 'Completion Rate', value: analyses.length ? formatPct01(completed / analyses.length, 0) : '—', hint: 'Across all runs', color: 'var(--c-success)', spark: [90, 85, 95, 92, 98, 100], icon: Activity },
    { label: 'Awaiting Action', value: actionQueue.length, hint: 'Action items pending', color: actionQueue.length ? 'var(--c-warning)' : 'var(--c-success)', spark: [5, 4, 6, 2, 3, actionQueue.length], icon: AlertCircle },
  ]

  return (
    <div className="space-y-6">
      {/* ── Top Header & KPI strip ── */}
      <div className="flex items-center justify-between pb-2 border-b border-(--border-subtle)">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-(--c-success-bg) border border-(--c-success-border) px-2.5 py-1 text-[10px] font-bold upperootLensse tracking-[0.16em] text-(--c-success) mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--c-success) opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-(--c-success)"></span>
            </span>
            System Online
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-(--text-1)">
            {getGreeting()}, operator.
          </h1>
          <p className="mt-1 text-sm text-(--text-3)">
            {actionQueue.length > 0
              ? `${actionQueue.length} dataset${actionQueue.length > 1 ? 's' : ''} require${actionQueue.length === 1 ? 's' : ''} your attention.`
              : `All systems nominal.`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button to="/upload" className="h-9 shadow-sm shadow-(--brand-dim)">
            <PlusCircle className="h-4 w-4" /> New Dataset
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`relative overflow-hidden rounded-md border border-(--border-subtle) bg-(--surface-1) p-4 transition-all duration-200 hover:border-(--border-default) hover:bg-(--surface-2)`}>
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full" style={{ background: kpi.color }} />

            <div className="flex items-start justify-between pl-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold upperootLensse tracking-[0.12em] text-(--text-3)">{kpi.label}</p>
                <p className="mt-2 text-3xl font-bold text-(--text-1) tracking-tight leading-none font-mono">
                  {typeof kpi.value === 'number' ? <NumberTicker value={kpi.value} /> : kpi.value}
                </p>
                <p className="mt-1.5 text-xs text-(--text-2)">{kpi.hint}</p>
              </div>
              <Sparkline values={kpi.spark} color={kpi.color} />
            </div>
          </div>
        ))}
      </section>

      {/* ── Main grid ── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-6 min-w-0">

          {/* Recent datasets */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-(--border-subtle)">
              <div>
                <h2 className="text-sm font-bold text-(--text-1) upperootLensse tracking-widest">Recent Datasets</h2>
              </div>
              <Link to="/datasets" className="text-xs font-semibold text-(--brand) hover:text-(--text-1) transition-colors flex items-center gap-1">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((dataset) => {
                const latest = latestByDataset.get(dataset.id)
                const tone = latest ? statusTone(latest.status) : 'default'
                const accentColor =
                  tone === 'success' ? 'var(--c-success)' :
                    tone === 'risk' ? 'var(--c-danger)' :
                      tone === 'warning' ? 'var(--c-warning)' :
                        tone === 'info' ? 'var(--c-info)' :
                          'var(--border-default)'

                return (
                  <Link
                    key={dataset.id}
                    to={`/datasets/${dataset.id}`}
                    className="group relative overflow-hidden rounded-md border border-(--border-subtle) bg-(--surface-1) p-4 transition-colors hover:border-(--border-default) hover:bg-(--surface-2)"
                  >
                    {/* Top accent */}
                    <div className="absolute top-0 left-0 bottom-0 w-1 transition-transform"
                      style={{ background: accentColor }} />

                    <div className="flex items-start justify-between gap-2 mb-2 pl-2">
                      <h3 className="text-sm font-semibold text-(--text-1) truncate min-w-0 group-hover:text-(--brand) transition-colors">
                        {dataset.name}
                      </h3>
                      {latest && (
                        <StatusBadge tone={tone} dot={IN_FLIGHT.has(latest.status)} pulse={IN_FLIGHT.has(latest.status)}
                          className="shrink-0 text-[9px]">
                          {latest.status}
                        </StatusBadge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-(--text-3) font-mono pl-2">
                      <span>{dataset.rows.toLocaleString()} rows</span>
                      <span>{dataset.cols} cols</span>
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />{timeAgo(dataset.created_at)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Action items */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-(--border-subtle)">
              <div>
                <h2 className="text-sm font-bold text-(--text-1) upperootLensse tracking-widest flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Action Items
                </h2>
              </div>
            </div>

            {actionQueue.length ? (
              <div className="space-y-3">
                {actionQueue.map(({ dataset, reason, tone, icon: Icon }) => {
                  return (
                    <div key={dataset.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-(--border-subtle) bg-(--surface-1) p-3 transition-colors hover:border-(--border-default)">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${tone === 'risk' ? 'text-(--c-danger)' : tone === 'warning' ? 'text-(--c-warning)' : 'text-(--c-info)'}`} />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-(--text-1) truncate">{dataset.name}</h3>
                          <p className="text-xs text-(--text-2) mt-0.5">{reason}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={tone === 'risk' ? 'danger' : 'secondary'}
                        to={`/datasets/${dataset.id}`}
                        className="shrink-0 h-8"
                      >
                        Resolve <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-md border border-dashed border-(--border-subtle) bg-(--surface-1) py-8 text-center">
                <p className="text-sm text-(--text-3)">All datasets have recent successful analyses.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Activity feed */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-(--border-subtle)">
            <h2 className="text-sm font-bold text-(--text-1) upperootLensse tracking-widest">Activity Feed</h2>
          </div>

          <div className="relative space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {recentRuns.length ? (
              recentRuns.map((run) => (
                <Link
                  key={run.id}
                  to={`/analyses/${run.id}`}
                  className="block rounded-md border border-(--border-subtle) bg-(--surface-1) p-3 transition-all hover:border-(--border-default) hover:bg-(--surface-2)"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <StatusBadge tone={statusTone(run.status)} dot={IN_FLIGHT.has(run.status)} pulse={IN_FLIGHT.has(run.status)} className="text-[9px]">
                      {run.status}
                    </StatusBadge>
                    <span className="text-[10px] text-(--text-3)">{timeAgo(run.created_at)}</span>
                  </div>
                  <p className="truncate text-sm font-semibold text-(--text-1)">{run.dataset_name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-(--text-3)">
                    target: <span className="text-(--text-2)">{run.target}</span>
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-xs text-(--text-3) py-4 text-center">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
