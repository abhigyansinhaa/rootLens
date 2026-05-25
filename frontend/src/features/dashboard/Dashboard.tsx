import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { formatPct01 } from '../../components/kpi/format'
import {
  Button,
  Card,
  CardEyebrow,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '../../components/ui'
import { ArrowRight, CheckCircle2, Clock, PlayCircle, PlusCircle, AlertCircle, Sparkles } from 'lucide-react'
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

function timeAgo(iso: string) {
  try {
    const now = new Date().getTime()
    const diff = now - new Date(iso).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  } catch {
    return iso
  }
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const DASHBOARD_IN_FLIGHT = new Set(['queued', 'running', 'profiling', 'training', 'explaining', 'decisioning'])
const DASHBOARD_TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed') return 'risk'
  if (DASHBOARD_IN_FLIGHT.has(status)) return 'warning'
  return 'default'
}

function Sparkline({ color, values }: { color: string, values: number[] }) {
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  
  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = 100 - ((val - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 -10 100 120" className="w-16 h-8 opacity-40 overflow-visible" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-fade-in-up"
      />
    </svg>
  )
}

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: string | number, prefix?: string, suffix?: string }) {
  const [displayValue, setDisplayValue] = useState<string | number>(typeof value === 'number' ? 0 : '')
  
  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value)
      return
    }
    
    let start = 0
    const end = value
    const duration = 1000
    const increment = end / (duration / 16)
    
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setDisplayValue(end)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.floor(start))
      }
    }, 16)
    
    return () => clearInterval(timer)
  }, [value])
  
  return (
    <span>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  )
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
  
  const recent = useMemo(
    () => [...datasets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
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
    () => [...analyses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [analyses],
  )

  const priorityQueue = useMemo(() => {
    const items: { dataset: Dataset; reason: string; tone: 'risk' | 'warning' | 'info', icon: any }[] = []
    for (const ds of datasets) {
      const latest = latestByDataset.get(ds.id)
      if (!latest) {
        items.push({ dataset: ds, reason: 'Requires initial analysis', tone: 'warning', icon: AlertCircle })
      } else if (latest.status === 'failed') {
        items.push({ dataset: ds, reason: 'Last run failed - review needed', tone: 'risk', icon: AlertCircle })
      } else if (DASHBOARD_IN_FLIGHT.has(latest.status)) {
        items.push({ dataset: ds, reason: 'Analysis in progress', tone: 'info', icon: PlayCircle })
      }
    }
    return items.slice(0, 4)
  }, [datasets, latestByDataset])

  const listError = datasetsQuery.error || analysesQuery.error
    ? "We couldn't load workspace metadata. Retry after confirming login and API uptime." : null

  if (datasetsQuery.isLoading || analysesQuery.isLoading) {
    return <LoadingState rows={4} />
  }

  if (listError) {
    return <ErrorState message={listError} onRetry={() => { datasetsQuery.refetch(); analysesQuery.refetch() }} />
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
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-950 via-brand-900 to-indigo-950 p-6 sm:p-8">
        <div className="absolute right-0 top-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {getGreeting()}, Operator.
            </h1>
            <p className="mt-2 max-w-xl text-brand-100/80">
              Workspace is healthy. You have {priorityQueue.length} datasets requiring attention and {completedAnalyses} completed analyses ready for review.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button to="/upload" className="bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/20">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Dataset
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Indexed Datasets', value: datasetCount, hint: `${totalRows.toLocaleString()} rows`, color: 'var(--color-brand-400)', spark: [2, 4, 3, 6, 8, 12, datasetCount] },
          { label: 'Tracked Analyses', value: analyses.length, hint: `${completedAnalyses} completed`, color: 'oklch(0.62 0.04 264)', spark: [1, 3, 5, 4, 7, 9, analyses.length] },
          { label: 'Completion Rate', value: formatPct01(analyses.length ? completedAnalyses / analyses.length : 0, 0), hint: 'Across all runs', color: 'oklch(0.62 0.17 152)', spark: [90, 85, 95, 92, 98, 100] },
          { label: 'Awaiting Decision', value: priorityQueue.length, hint: 'Action items pending', color: priorityQueue.length ? 'oklch(0.78 0.17 80)' : 'oklch(0.62 0.04 264)', spark: [5, 4, 6, 2, 3, priorityQueue.length] }
        ].map((kpi, i) => (
          <div key={kpi.label} className={`relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 transition-all hover:-translate-y-1 hover:shadow-lg animate-fade-in-up delay-${(i+1)*100}`}>
            <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: kpi.color }} />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">{kpi.label}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-[var(--text-1)]">
                  <AnimatedCounter value={kpi.value} />
                </p>
                <p className="mt-1 text-xs text-[var(--text-2)]">{kpi.hint}</p>
              </div>
              <Sparkline color={kpi.color} values={kpi.spark} />
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content Area */}
        <div className="space-y-6">
          {/* Action Items Timeline */}
          <Card padding="lg" elevated className="glass border-t-brand-500 border-t-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-[var(--text-1)]">Action Items</h2>
                <p className="text-sm text-[var(--text-2)]">Priority queue requiring operator attention.</p>
              </div>
              <Sparkles className="h-5 w-5 text-brand-500" />
            </div>

            {priorityQueue.length ? (
              <div className="relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-subtle)] space-y-6">
                {priorityQueue.map(({ dataset, reason, tone, icon: Icon }, i) => (
                  <div key={dataset.id} className={`relative animate-slide-in-left delay-${(i+1)*100}`}>
                    <div className={`absolute -left-[29px] top-1 h-5 w-5 rounded-full border-4 border-[var(--surface-1)] bg-${tone === 'risk' ? 'red' : tone === 'warning' ? 'amber' : 'brand'}-500`} />
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-4 transition-colors hover:bg-[var(--surface-3)]/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 text-${tone === 'risk' ? 'red' : tone === 'warning' ? 'amber' : 'brand'}-500`} />
                          <h3 className="font-bold text-[var(--text-1)]">{dataset.name}</h3>
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-2)]">{reason}</p>
                      </div>
                      <Button size="sm" variant={tone === 'risk' ? 'danger' : 'primary'} to={`/datasets/${dataset.id}`}>
                        Resolve
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/30 py-12 text-center">
                <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-500 opacity-80" />
                <p className="text-sm font-medium text-[var(--text-1)]">Inbox Zero</p>
                <p className="mt-1 text-xs text-[var(--text-2)]">All datasets have recent successful analyses.</p>
              </div>
            )}
          </Card>

          {/* Dataset Grid */}
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-[var(--text-1)]">Recent Datasets</h2>
                <p className="text-sm text-[var(--text-2)]">Inventory of uploaded data tables.</p>
              </div>
              <Link to="/datasets" className="text-sm font-semibold text-brand-600 hover:text-brand-500">
                View all →
              </Link>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {recent.map((dataset, i) => {
                const latest = latestByDataset.get(dataset.id)
                const tone = latest ? statusTone(latest.status) : 'default'
                
                return (
                  <Link
                    key={dataset.id}
                    to={`/datasets/${dataset.id}`}
                    className={`group relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-all hover:border-[var(--border-strong)] hover:shadow-md animate-fade-in-up delay-${(i+2)*100}`}
                  >
                    <div className={`absolute top-0 left-0 h-1 w-full bg-${tone === 'success' ? 'emerald' : tone === 'risk' ? 'red' : tone === 'warning' ? 'amber' : 'slate'}-500 transition-transform origin-left scale-x-0 group-hover:scale-x-100`} />
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-[var(--text-1)] truncate pr-2">{dataset.name}</h3>
                      {latest && (
                        <StatusBadge tone={tone} className="shrink-0 scale-90 origin-top-right">
                          {latest.status}
                        </StatusBadge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-2)]">
                      <span className="tabular-nums font-mono">{dataset.rows.toLocaleString()}r × {dataset.cols}c</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {timeAgo(dataset.created_at)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Sidebar / Activity Feed */}
        <div className="space-y-6">
          <Card padding="md" className="bg-[var(--surface-2)]/50 border-none shadow-none">
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-3)] mb-4">Activity Feed</h2>
            {recentRuns.length ? (
              <div className="space-y-3">
                {recentRuns.map((run, i) => (
                  <Link
                    key={run.id}
                    to={`/analyses/${run.id}`}
                    className={`block rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 transition-colors hover:border-brand-500/50 hover:bg-brand-50/10 dark:hover:bg-brand-500/5 animate-slide-in-left delay-${(i+1)*100}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge tone={statusTone(run.status)} dot className="scale-75 origin-left -ml-1">
                        {run.status}
                      </StatusBadge>
                      <span className="text-[10px] font-medium text-[var(--text-3)]">{timeAgo(run.created_at)}</span>
                    </div>
                    <p className="truncate text-sm font-bold text-[var(--text-1)]">{run.dataset_name}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-2)]">
                      target: <span className="text-brand-600 dark:text-brand-400">{run.target}</span>
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-3)]">No recent activity.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
