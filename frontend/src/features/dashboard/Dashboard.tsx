import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { formatPct01 } from '../../components/kpi/format'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '../../components/ui'
import {
  ArrowRight, CheckCircle2, Clock, PlayCircle,
  PlusCircle, AlertCircle, ArrowUpRight,
  Database, BarChart3, Activity,
} from 'lucide-react'
import type { AnalysisListItem, Dataset } from '../../types'

/* ─── helpers ─── */
function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 60)  return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return iso }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const IN_FLIGHT  = new Set(['queued','running','profiling','training','explaining','decisioning'])
const TERMINAL_OK = new Set(['completed','completed_with_warnings'])

function statusTone(status: string): 'default'|'info'|'success'|'warning'|'risk' {
  if (status === 'completed')               return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed')                  return 'risk'
  if (IN_FLIGHT.has(status))               return 'warning'
  return 'default'
}

/* ─── Animated KPI counter ─── */
function Counter({ value }: { value: number | string }) {
  const [display, setDisplay] = useState<number | string>(typeof value === 'number' ? 0 : value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof value !== 'number') { setDisplay(value); return }
    const end = value, start = performance.now(), dur = 1000
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(e * end))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return <>{typeof display === 'number' ? display.toLocaleString() : display}</>
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
    queryFn:  async () => { const { data } = await api.get<Dataset[]>('/datasets', { params: { limit: 500 } }); return data },
  })
  const analysesQuery = useQuery({
    queryKey: ['analyses'],
    queryFn:  async () => { const { data } = await api.get<AnalysisListItem[]>('/analyses', { params: { limit: 200 } }); return data },
  })

  const datasets  = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data])
  const analyses  = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data])
  const completed = analyses.filter(a => TERMINAL_OK.has(a.status)).length
  const totalRows = datasets.reduce((s, d) => s + d.rows, 0)

  const recent = useMemo(
    () => [...datasets].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
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
    () => [...analyses].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [analyses],
  )

  const actionQueue = useMemo(() => {
    const items: { dataset: Dataset; reason: string; tone: 'risk'|'warning'|'info'; icon: React.ElementType }[] = []
    for (const ds of datasets) {
      const latest = latestByDataset.get(ds.id)
      if (!latest)                       items.push({ dataset: ds, reason: 'Requires initial analysis', tone: 'warning', icon: AlertCircle })
      else if (latest.status === 'failed') items.push({ dataset: ds, reason: 'Last run failed — review needed', tone: 'risk', icon: AlertCircle })
      else if (IN_FLIGHT.has(latest.status)) items.push({ dataset: ds, reason: 'Analysis in progress', tone: 'info', icon: PlayCircle })
    }
    return items.slice(0, 4)
  }, [datasets, latestByDataset])

  if (datasetsQuery.isLoading || analysesQuery.isLoading)
    return <LoadingState rows={4} message="Loading workspace…" />

  if (datasetsQuery.error || analysesQuery.error)
    return <ErrorState message="We couldn't load workspace data. Retry after confirming login and API uptime." onRetry={() => { datasetsQuery.refetch(); analysesQuery.refetch() }} />

  if (!datasets.length && !analyses.length)
    return (
      <EmptyState
        title="Start your RootLens workspace"
        description="Upload a CSV or Parquet dataset, select a target column, and turn model outputs into decisions."
        action={<Button to="/upload"><PlusCircle className="h-4 w-4" /> Upload dataset</Button>}
      />
    )

  const kpis = [
    { label: 'Indexed Datasets',  value: datasets.length,  hint: `${totalRows.toLocaleString()} rows total`, color: 'var(--brand)',      spark: [2,4,3,6,8,12,datasets.length], icon: Database },
    { label: 'Total Analyses',    value: analyses.length,  hint: `${completed} completed`,                    color: 'var(--c-info)',      spark: [1,3,5,4,7,9,analyses.length], icon: BarChart3 },
    { label: 'Completion Rate',   value: analyses.length ? formatPct01(completed / analyses.length, 0) : '—', hint: 'Across all runs',   color: 'var(--c-success)',  spark: [90,85,95,92,98,100], icon: Activity },
    { label: 'Awaiting Action',   value: actionQueue.length, hint: 'Action items pending',                  color: actionQueue.length ? 'var(--c-warning)' : 'var(--c-success)', spark: [5,4,6,2,3,actionQueue.length], icon: AlertCircle },
  ]

  return (
    <div className="space-y-8">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-8 animate-fade-in-up">
        {/* Ambient glow */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--brand) 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--color-purple-500) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand)] mb-1">
              Workspace Overview
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)] sm:text-3xl">
              {getGreeting()}, operator.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-2)]">
              {actionQueue.length > 0
                ? `${actionQueue.length} dataset${actionQueue.length > 1 ? 's' : ''} need${actionQueue.length === 1 ? 's' : ''} attention. ${completed} completed ${completed === 1 ? 'analysis' : 'analyses'} ready for review.`
                : `All datasets are up to date. ${completed} completed ${completed === 1 ? 'analysis' : 'analyses'} ready for review.`
              }
            </p>
          </div>
          <Button to="/upload" className="shrink-0">
            <PlusCircle className="h-4 w-4" /> New Dataset
          </Button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className={`relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 transition-all duration-[var(--duration-normal)] hover:border-[var(--border-default)] hover:bg-[var(--surface-2)] animate-spring-up delay-${(i+1)*75}`}
          >
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full" style={{ background: kpi.color }} />

            <div className="flex items-start justify-between pl-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">{kpi.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-[var(--text-1)] tracking-tight leading-none font-[var(--font-mono)]">
                  <Counter value={kpi.value} />
                </p>
                <p className="mt-1.5 text-xs text-[var(--text-2)]">{kpi.hint}</p>
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
          {/* Action items */}
          <Card padding="lg" className="animate-fade-in-up delay-200">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-base font-bold text-[var(--text-1)]">Action Items</h2>
                <p className="text-sm text-[var(--text-2)] mt-0.5">Priority queue requiring attention</p>
              </div>
              <AlertCircle className="h-4 w-4 text-[var(--text-3)]" />
            </div>

            {actionQueue.length ? (
              <div className="relative space-y-4 pl-5 before:absolute before:left-1.5 before:top-3 before:bottom-3 before:w-px before:bg-[var(--border-subtle)]">
                {actionQueue.map(({ dataset, reason, tone, icon: Icon }, i) => {
                  const dotColor =
                    tone === 'risk'    ? 'bg-[var(--c-danger)]'  :
                    tone === 'warning' ? 'bg-[var(--c-warning)]' :
                                         'bg-[var(--c-info)]'

                  return (
                    <div key={dataset.id} className={`relative animate-slide-in-left delay-${(i+1)*100}`}>
                      <span aria-hidden className={`absolute -left-[19px] top-3 h-3 w-3 rounded-full border-2 border-[var(--surface-1)] ${dotColor}`} />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 transition-colors hover:border-[var(--border-default)]">
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${tone === 'risk' ? 'text-[var(--c-danger)]' : tone === 'warning' ? 'text-[var(--c-warning)]' : 'text-[var(--c-info)]'}`} />
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[var(--text-1)] truncate">{dataset.name}</h3>
                            <p className="text-xs text-[var(--text-2)] mt-0.5">{reason}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={tone === 'risk' ? 'danger' : 'secondary'}
                          to={`/datasets/${dataset.id}`}
                          className="shrink-0"
                        >
                          Resolve <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/40 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--c-success-bg)] border border-[var(--c-success-border)] mb-3">
                  <CheckCircle2 className="h-5 w-5 text-[var(--c-success)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--text-1)]">Inbox zero</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">All datasets have recent successful analyses.</p>
              </div>
            )}
          </Card>

          {/* Recent datasets */}
          <Card padding="lg" className="animate-fade-in-up delay-300">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-base font-bold text-[var(--text-1)]">Recent Datasets</h2>
                <p className="text-sm text-[var(--text-2)] mt-0.5">Inventory of uploaded data tables</p>
              </div>
              <Link to="/datasets" className="text-xs font-semibold text-[var(--brand)] hover:brightness-110 transition-all flex items-center gap-1">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {recent.map((dataset, i) => {
                const latest = latestByDataset.get(dataset.id)
                const tone   = latest ? statusTone(latest.status) : 'default'
                const accentColor =
                  tone === 'success' ? 'var(--c-success)' :
                  tone === 'risk'    ? 'var(--c-danger)'  :
                  tone === 'warning' ? 'var(--c-warning)' :
                  tone === 'info'    ? 'var(--c-info)'    :
                                       'var(--border-default)'

                return (
                  <Link
                    key={dataset.id}
                    to={`/datasets/${dataset.id}`}
                    className={`group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 hover:border-[var(--border-brand)] hover:shadow-[var(--shadow-md)] animate-spring-up delay-${Math.min((i+3)*75, 500)}`}
                  >
                    {/* Top accent */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] transition-transform origin-left scale-x-0 group-hover:scale-x-100"
                      style={{ background: accentColor }} />

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-[var(--text-1)] truncate min-w-0 group-hover:text-[var(--brand)] transition-colors">
                        {dataset.name}
                      </h3>
                      {latest && (
                        <StatusBadge tone={tone} dot={IN_FLIGHT.has(latest.status)} pulse={IN_FLIGHT.has(latest.status)}
                          className="shrink-0 text-[9px]">
                          {latest.status}
                        </StatusBadge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--text-3)] font-[var(--font-mono)]">
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
          </Card>
        </div>

        {/* Right column — Activity feed */}
        <div className="space-y-4 animate-fade-in-up delay-400">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Activity Feed</h2>
            <p className="text-xs text-[var(--text-3)] mt-0.5">Latest analysis runs</p>
          </div>

          <div className="relative space-y-2 max-h-[520px] overflow-y-auto pr-1"
            style={{ maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)' }}>
            {recentRuns.length ? (
              recentRuns.map((run, i) => (
                <Link
                  key={run.id}
                  to={`/analyses/${run.id}`}
                  className={`block rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 transition-all hover:border-[var(--border-brand)] hover:bg-[var(--surface-2)] animate-slide-in-right delay-${(i+1)*75}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <StatusBadge tone={statusTone(run.status)} dot={IN_FLIGHT.has(run.status)} pulse={IN_FLIGHT.has(run.status)} className="text-[9px]">
                      {run.status}
                    </StatusBadge>
                    <span className="text-[10px] text-[var(--text-3)]">{timeAgo(run.created_at)}</span>
                  </div>
                  <p className="truncate text-sm font-semibold text-[var(--text-1)]">{run.dataset_name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-3)]">
                    target: <span className="text-[var(--brand)]">{run.target}</span>
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-xs text-[var(--text-3)] py-4 text-center">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
