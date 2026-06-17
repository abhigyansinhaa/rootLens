import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import {
  Button, Card, CardEyebrow, EmptyState, ErrorState, Input,
  LoadingState, PageHeader, Select, StatusBadge,
} from '../../components/ui'
import {
  Database, Search, LayoutGrid, List,
  FileSpreadsheet, Clock, ArrowRight, Upload,
} from 'lucide-react'
import type { Dataset } from '../../types'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function freshnessOf(iso: string): { tone: 'success'|'warning'|'default'; label: string } {
  const days = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 7)  return { tone: 'success', label: 'Fresh'  }
  if (days < 30) return { tone: 'default', label: 'Recent' }
  return            { tone: 'warning',     label: 'Stale'  }
}

export function Datasets() {
  const [query,    setQuery]    = useState('')
  const [sort,     setSort]     = useState<'recent'|'name'|'rows'>('recent')
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['datasets'],
    queryFn:  async () => { const { data } = await api.get<Dataset[]>('/datasets', { params: { limit: 500 } }); return data },
  })

  const filtered = useMemo(() => {
    if (!data?.length) return []
    const q = query.trim().toLowerCase()
    const list = q
      ? data.filter(d => d.name.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q) || d.file_format.toLowerCase().includes(q))
      : [...data]
    if (sort === 'recent') list.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name))
    else list.sort((a,b) => b.rows - a.rows)
    return list
  }, [data, query, sort])

  const totalRows = data?.reduce((s,d) => s + d.rows, 0) ?? 0
  const formats   = useMemo(() => Array.from(new Set((data ?? []).map(d => d.file_format.toUpperCase()))), [data])

  if (isLoading) return <LoadingState rows={4} />
  if (error) return <ErrorState message="We couldn't load your datasets. Check your connection and try again." onRetry={() => void refetch()} />

  return (
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        eyebrow="Data Inventory"
        title="Datasets"
        description="Find uploaded tables, check freshness, and open a dataset to configure the next root-cause run."
        meta={data && data.length > 0 ? (
          <>
            <StatusBadge tone="info">{data.length} datasets</StatusBadge>
            <StatusBadge tone="default">{totalRows.toLocaleString()} rows</StatusBadge>
            {formats.map(f => <StatusBadge key={f} tone="neutral">{f}</StatusBadge>)}
          </>
        ) : null}
        actions={
          <Button to="/upload">
            <Upload className="h-4 w-4" /> Upload dataset
          </Button>
        }
      />

      {data && data.length === 0 && (
        <EmptyState
          title="No datasets yet"
          description="Upload a CSV or Parquet file to create your first dataset and start an analysis."
          icon={<Database className="h-7 w-7" />}
          action={<Button to="/upload"><Upload className="h-4 w-4" /> Upload dataset</Button>}
        />
      )}

      {data && data.length > 0 && (
        <>
          {/* ── Toolbar ── */}
          <div className="glass-2 sticky top-[calc(var(--app-header-height)+1rem)] z-20 rounded-[var(--radius-lg)] border border-[var(--border-default)] p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1 max-w-sm group">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] transition-colors group-focus-within:text-[var(--brand)]" />
                  <Input
                    placeholder="Search by name, filename, format…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoComplete="off"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={sort}
                  onChange={e => setSort(e.target.value as typeof sort)}
                  className="w-40 shrink-0"
                >
                  <option value="recent">Recently added</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="rows">Row count</option>
                </Select>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 shrink-0">
                {(['grid', 'list'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={[
                      'rounded-[var(--radius-sm)] p-1.5 transition-all',
                      viewMode === mode
                        ? 'bg-[var(--surface-1)] text-[var(--brand)] shadow-[var(--shadow-xs)]'
                        : 'text-[var(--text-3)] hover:text-[var(--text-1)]',
                    ].join(' ')}
                    title={`${mode} view`}
                  >
                    {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── No results ── */}
          {filtered.length === 0 && (
            <Card padding="lg" tone="strong" className="text-center text-sm text-[var(--text-2)]">
              No datasets match "{query}". Try a different search.
            </Card>
          )}

          {/* ── Grid view ── */}
          {filtered.length > 0 && viewMode === 'grid' && (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d, i) => {
                const fresh = freshnessOf(d.created_at)
                return (
                  <li key={d.id} className={`animate-spring-up delay-${Math.min((i+1)*75, 500)}`}>
                    <Link to={`/datasets/${d.id}`} className="group block h-full">
                      <div className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] transition-all duration-[var(--duration-normal)] hover:-translate-y-1 hover:border-[var(--border-brand)] hover:shadow-[var(--shadow-lg),0_0_30px_hsl(214_100%_59%/0.08)]">
                        {/* Top accent (reveals on hover) */}
                        <div className="h-[2px] w-full bg-[var(--brand)] transition-transform origin-left scale-x-0 group-hover:scale-x-100" />

                        <div className="flex flex-1 flex-col gap-3 p-5">
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--text-3)]" />
                              <CardEyebrow>{d.file_format.toUpperCase()}</CardEyebrow>
                            </div>
                            <StatusBadge tone={fresh.tone} dot className="text-[9px]">
                              {fresh.label}
                            </StatusBadge>
                          </div>

                          {/* Name */}
                          <h2 className="text-base font-bold tracking-tight text-[var(--text-1)] group-hover:text-[var(--brand)] transition-colors leading-snug">
                            {d.name}
                          </h2>
                          <p className="truncate font-[var(--font-mono)] text-[10px] text-[var(--text-3)]" title={d.filename}>
                            {d.filename}
                          </p>

                          {/* Stats */}
                          <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-4">
                            <div>
                              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Rows</dt>
                              <dd className="mt-0.5 font-[var(--font-mono)] text-sm font-semibold tabular-nums text-[var(--text-1)]">
                                {d.rows.toLocaleString()}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Columns</dt>
                              <dd className="mt-0.5 font-[var(--font-mono)] text-sm font-semibold tabular-nums text-[var(--text-1)]">
                                {d.cols}
                              </dd>
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-[var(--text-3)]">
                              <Clock className="h-3 w-3" /> Added {formatDate(d.created_at)}
                            </div>
                          </dl>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {/* ── List view ── */}
          {filtered.length > 0 && viewMode === 'list' && (
            <ul className="flex flex-col gap-2">
              {filtered.map((d, i) => {
                const fresh = freshnessOf(d.created_at)
                const accentBg =
                  fresh.tone === 'success' ? 'bg-[var(--c-success)]' :
                  fresh.tone === 'warning' ? 'bg-[var(--c-warning)]' :
                                              'bg-[var(--border-strong)]'

                return (
                  <li key={d.id} className={`animate-slide-in-left delay-${Math.min((i+1)*50, 400)}`}>
                    <Link to={`/datasets/${d.id}`} className="group relative block overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-all hover:border-[var(--border-brand)] hover:bg-[var(--surface-2)]">
                      {/* Left stripe */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentBg} transition-all`} />

                      <div className="flex min-w-0 items-center gap-4 pl-3">
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-sm font-semibold text-[var(--text-1)] group-hover:text-[var(--brand)] transition-colors">
                            {d.name}
                          </h2>
                          <p className="truncate font-[var(--font-mono)] text-[10px] text-[var(--text-3)] mt-0.5">{d.filename}</p>
                        </div>

                        <div className="hidden md:flex items-center gap-8 text-right font-[var(--font-mono)] text-xs text-[var(--text-2)] tabular-nums shrink-0">
                          <div><span className="text-[var(--text-3)] mr-1.5">R</span>{d.rows.toLocaleString()}</div>
                          <div><span className="text-[var(--text-3)] mr-1.5">C</span>{d.cols}</div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span className="hidden sm:inline text-xs text-[var(--text-3)]">{formatDate(d.created_at)}</span>
                          <StatusBadge tone={fresh.tone} dot className="text-[9px]">{fresh.label}</StatusBadge>
                          <ArrowRight className="h-4 w-4 text-[var(--text-3)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--text-1)]" />
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
