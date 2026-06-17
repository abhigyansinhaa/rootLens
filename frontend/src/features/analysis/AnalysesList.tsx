import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../../components/ui'
import { BarChart3, ArrowRight, Clock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { AnalysisListItem } from '../../types'

const IN_FLIGHT  = new Set(['queued','running','profiling','training','explaining','decisioning'])
const TERMINAL_OK = new Set(['completed','completed_with_warnings'])

function statusTone(status: string): 'default'|'info'|'success'|'warning'|'risk' {
  if (status === 'completed')               return 'success'
  if (status === 'completed_with_warnings') return 'warning'
  if (status === 'failed')                  return 'risk'
  if (IN_FLIGHT.has(status))               return 'info'
  return 'default'
}

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

export function AnalysesList() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['analyses'],
    queryFn: async () => {
      const { data } = await api.get<AnalysisListItem[]>('/analyses', { params: { limit: 200 } })
      return data
    },
  })

  const analyses = useMemo(() => data ?? [], [data])
  const completed = analyses.filter(a => TERMINAL_OK.has(a.status)).length
  const inFlight  = analyses.filter(a => IN_FLIGHT.has(a.status)).length

  if (isLoading) return <LoadingState rows={4} message="Loading analyses…" />
  if (error)     return <ErrorState message="Could not load analyses." onRetry={() => void refetch()} />

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
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        eyebrow="Workspace"
        title="All Analyses"
        description={`${analyses.length} total · ${completed} completed · ${inFlight} in progress`}
      />

      <div className="grid gap-3">
        {analyses
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map((run, i) => {
            const tone = statusTone(run.status)
            const running = IN_FLIGHT.has(run.status)
            return (
              <Link
                key={run.id}
                to={`/analyses/${run.id}`}
                className={[
                  'group flex items-center gap-4 rounded-[var(--radius-lg)]',
                  'border border-[var(--border-subtle)] bg-[var(--surface-1)]',
                  'p-4 transition-all duration-[var(--duration-normal)]',
                  'hover:border-[var(--border-brand)] hover:bg-[var(--surface-2)] hover:-translate-y-px hover:shadow-[var(--shadow-md)]',
                  `animate-slide-in-right delay-${Math.min((i + 1) * 30, 300)}`,
                ].join(' ')}
              >
                {/* Status dot */}
                <div className={[
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  tone === 'success' ? 'bg-[var(--c-success)]' :
                  tone === 'risk'    ? 'bg-[var(--c-danger)]'  :
                  tone === 'warning' ? 'bg-[var(--c-warning)]' :
                  tone === 'info'    ? 'bg-[var(--c-info)]'    :
                  'bg-[var(--text-4)]',
                  running ? 'animate-pulse' : '',
                ].join(' ')} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--text-1)] group-hover:text-[var(--brand)] transition-colors truncate">
                      {run.dataset_name}
                    </span>
                    <StatusBadge tone={tone} dot={running} pulse={running} className="text-[9px] shrink-0">
                      {run.status}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-3)]">
                    <span>
                      target: <span className="text-[var(--brand)] font-medium">{run.target}</span>
                    </span>
                    {run.task_type && (
                      <span className="capitalize">{run.task_type.replace('_', ' ')}</span>
                    )}
                    {run.value_column && (
                      <span>value: <span className="text-[var(--c-success)]">{run.value_column}</span></span>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 shrink-0 text-[11px] text-[var(--text-3)] font-[var(--font-mono)]">
                  <Clock className="h-3 w-3" />
                  {timeAgo(run.created_at)}
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-4)] group-hover:text-[var(--brand)] transition-colors" />
              </Link>
            )
          })}
      </div>
    </div>
  )
}
