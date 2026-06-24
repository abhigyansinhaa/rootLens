import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import {
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
  AnimatedList,
} from '../../components/ui'
import { AnalysesListSkeleton } from '../../components/PageSkeletons'
import { BarChart3, ArrowRight, Clock, Search, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { KpiSparkline } from './KpiSparkline'
import type { AnalysisListItem } from '../../types'

const IN_FLIGHT = new Set(['queued', 'running', 'profiling', 'training', 'explaining', 'decisioning'])
const TERMINAL_OK = new Set(['completed', 'completed_with_warnings'])

type StatusFilter = 'all' | 'running' | 'completed' | 'failed'

function statusTone(status: string): 'default' | 'info' | 'success' | 'warning' | 'risk' {
  if (status === 'completed') return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed') return 'risk'
  if (IN_FLIGHT.has(status)) return 'info'
  return 'default'
}

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

const STATUS_CHIPS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
]

export function AnalysesList() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['analyses'],
    queryFn: async () => {
      const { data } = await api.get<AnalysisListItem[]>('/analyses', { params: { limit: 200 } })
      return data
    },
    refetchInterval: (q) => {
      const d = q.state.data
      if (!d) return false
      return d.some(a => IN_FLIGHT.has(a.status)) ? 3000 : false
    },
  })

  const analyses = useMemo(() => data ?? [], [data])
  const completed = analyses.filter(a => TERMINAL_OK.has(a.status)).length
  const inFlight = analyses.filter(a => IN_FLIGHT.has(a.status)).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerootLensse()
    return analyses
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter(a => {
        const matchSearch = !q ||
          a.dataset_name.toLowerootLensse().includes(q) ||
          a.target.toLowerootLensse().includes(q)
        const matchStatus =
          statusFilter === 'all' ? true :
            statusFilter === 'running' ? IN_FLIGHT.has(a.status) :
              statusFilter === 'completed' ? TERMINAL_OK.has(a.status) :
                statusFilter === 'failed' ? a.status === 'failed' :
                  true
        return matchSearch && matchStatus
      })
  }, [analyses, search, statusFilter])

  if (isLoading) {
    return <AnalysesListSkeleton />
  }

  if (error) return <ErrorState message="Could not load analyses." onRetry={() => void refetch()} />

  if (!analyses.length) {
    return (
      <EmptyState
        title="No analyses yet"
        description="Run your first analysis from any dataset's detail page."
        action={<Button to="/datasets"><BarChart3 className="h-4 w-4" /> Go to Datasets</Button>}
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Workspace"
        title="All Analyses"
        description={`${analyses.length} total · ${completed} completed · ${inFlight} in progress`}
        actions={
          <Button variant="secondary" size="sm" to="/analyses/compare?ids=,">
            Compare two runs
          </Button>
        }
      />

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--text-3)" />
          <input
            type="search"
            placeholder="Search by dataset or target…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-(--border-default) bg-(--surface-2) py-2 pl-9 pr-9 text-sm text-(--text-1) placeholder:text-(--text-3) focus:border-(--border-focus) focus:outline-none focus:ring-1 focus:ring-(--border-focus) transition-colors"
            aria-label="Search analyses"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-(--text-3) hover:text-(--text-1)"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              aria-pressed={statusFilter === chip.value}
              className={[
                'rounded-full px-3 py-1.5 text-[11px] font-bold upperootLensse tracking-widest transition-all',
                statusFilter === chip.value
                  ? 'bg-(--brand-dim) border border-(--border-brand) text-(--brand)'
                  : 'border border-(--border-subtle) bg-(--surface-2) text-(--text-3) hover:text-(--text-1) hover:border-(--border-default)',
              ].join(' ')}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {(search || statusFilter !== 'all') && (
        <p className="text-xs text-(--text-3)">
          Showing <span className="font-semibold text-(--text-2)">{filtered.length}</span> of {analyses.length} analyses
          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all') }}
              className="ml-2 font-semibold text-(--brand) hover:underline"
            >
              Clear filters
            </button>
          )}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-(--text-3)">
          No analyses match your search.
        </div>
      ) : (
        <AnimatedList className="w-full items-stretch gap-2" delay={50}>
          {filtered.map((run) => {
            const tone = statusTone(run.status)
            const running = IN_FLIGHT.has(run.status)
            return (
              <Link
                key={run.id}
                to={`/analyses/${run.id}`}
                className={[
                  'group flex items-center gap-4 rounded-lg',
                  'border border-(--border-subtle) bg-(--surface-1)',
                  'p-4 transition-all duration-(--duration-normal)',
                  'hover:border-(--border-brand) hover:bg-(--surface-2) hover:-translate-y-px hover:shadow-(--shadow-md)',
                ].join(' ')}
              >
                {/* Status dot */}
                <div className={[
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  tone === 'success' ? 'bg-(--c-success)' :
                    tone === 'risk' ? 'bg-(--c-danger)' :
                      tone === 'warning' ? 'bg-(--c-warning)' :
                        tone === 'info' ? 'bg-(--c-info)' :
                          'bg-(--text-4)',
                  running ? 'animate-pulse' : '',
                ].join(' ')} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-(--text-1) group-hover:text-(--brand) transition-colors truncate">
                      {run.dataset_name}
                    </span>
                    <StatusBadge tone={tone} dot={running} pulse={running} className="text-[9px] shrink-0">
                      {run.status}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-(--text-3)">
                    <span>
                      target: <span className="text-(--brand) font-medium">{run.target}</span>
                    </span>
                    {run.task_type && (
                      <span className="capitalize">{run.task_type.replace('_', ' ')}</span>
                    )}
                    {run.value_column && (
                      <span>value: <span className="text-(--c-success)">{run.value_column}</span></span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 shrink-0 text-[11px] text-(--text-3) font-mono">
                  <Clock className="h-3 w-3" />
                  {timeAgo(run.created_at)}
                </div>

                {/* KPI Sparkline (only for completed analyses) */}
                {(run.status === 'completed' || run.status === 'completed_with_warnings') && (
                  <div className="ml-2 pl-4 border-l border-(--border-subtle) hidden sm:block">
                    <KpiSparkline
                      datasetId={run.dataset_id}
                      target={run.target}
                      kpiSummary={run.kpi_summary}
                    />
                  </div>
                )}

                <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-(--text-4) group-hover:text-(--brand) transition-colors" />
              </Link>
            )
          })}
        </AnimatedList>
      )}
    </div>
  )
}
