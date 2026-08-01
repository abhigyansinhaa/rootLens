import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import {
  Button, Card, CardEyebrow, EmptyState, ErrorState, Input,
  PageHeader, Select, StatusBadge,
  DataTable, THead, TBody, TR, TH, TD
} from '../../components/ui'
import { DatasetsListSkeleton } from '../../components/PageSkeletons'
import {
  Database, Search, LayoutGrid, List,
  FileSpreadsheet, Clock, Upload, ChevronRight,
} from 'lucide-react'
import type { Dataset } from '../../types'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}

function freshnessOf(iso: string): { tone: 'success' | 'warning' | 'default'; label: string } {
  const days = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 7) return { tone: 'success', label: 'Fresh' }
  if (days < 30) return { tone: 'default', label: 'Recent' }
  return { tone: 'warning', label: 'Stale' }
}

export function Datasets({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name' | 'rows'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => { const { data } = await api.get<Dataset[]>('/datasets', { params: { limit: 500 } }); return data },
  })

  const filtered = useMemo(() => {
    if (!data?.length) return []
    const q = query.trim().toLowerCase()
    const list = q
      ? data.filter(d => d.name.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q) || d.file_format.toLowerCase().includes(q))
      : [...data]
    if (sort === 'recent') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else list.sort((a, b) => b.rows - a.rows)
    return list
  }, [data, query, sort])

  const totalRows = data?.reduce((s, d) => s + d.rows, 0) ?? 0
  const formats = useMemo(() => Array.from(new Set((data ?? []).map(d => d.file_format.toUpperCase()))), [data])

  if (isLoading) return <DatasetsListSkeleton />
  if (error) return <ErrorState message="We couldn't load your datasets. Check your connection and try again." onRetry={() => void refetch()} />

  return (
    <div className={`space-y-4 animate-fade-in-up ${compact ? '' : 'space-y-8'}`}>
      {!compact && (
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
      )}

      {compact && (
        <div className="flex items-center justify-between pb-2 border-b border-(--border-subtle)">
          <h2 className="text-lg font-bold text-(--text-1)">Datasets</h2>
          <Button size="sm" to="/upload" variant="secondary" className="h-8 w-8 p-0 rounded-full">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      )}

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
          <div className={`${compact ? 'sticky top-0' : 'sticky top-[calc(var(--app-header-height)+1rem)]'} z-20 rounded-lg border border-(--border-default) bg-(--surface-1) p-2 sm:p-4`}>
            <div className={`flex gap-3 ${compact ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between'}`}>
              <div className={`flex flex-1 items-center gap-2 ${compact ? 'flex-col' : ''}`}>
                <div className={`relative w-full ${compact ? '' : 'max-w-sm flex-1'} group`}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-3) transition-colors group-focus-within:text-(--brand)" />
                  <Input
                    placeholder="Search…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoComplete="off"
                    className="pl-9 w-full"
                  />
                </div>
                {!compact && (
                  <Select
                    value={sort}
                    onChange={e => setSort(e.target.value as typeof sort)}
                    className="w-40 shrink-0"
                  >
                    <option value="recent">Recently added</option>
                    <option value="name">Name (A–Z)</option>
                    <option value="rows">Row count</option>
                  </Select>
                )}
              </div>

              {/* View toggle */}
              {!compact && (
                <div className="flex items-center gap-3 shrink-0">
                  {viewMode === 'list' && (
                    <div className="flex items-center gap-1 rounded-md border border-(--border-subtle) bg-(--surface-2) p-1 shrink-0">
                      {(['compact', 'comfortable'] as const).map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDensity(d)}
                          className={[
                            'rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all',
                            density === d
                              ? 'bg-(--surface-1) text-(--brand) shadow-sm'
                              : 'text-(--text-3) hover:text-(--text-1)',
                          ].join(' ')}
                          title={`${d} density`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 rounded-md border border-(--border-subtle) bg-(--surface-2) p-1 shrink-0">
                    {(['grid', 'list'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setViewMode(mode)}
                        className={[
                          'rounded-sm p-1.5 transition-all',
                          viewMode === mode
                            ? 'bg-(--surface-1) text-(--brand) shadow-(--shadow-xs)'
                            : 'text-(--text-3) hover:text-(--text-1)',
                        ].join(' ')}
                        title={`${mode} view`}
                      >
                        {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── No results ── */}
          {filtered.length === 0 && (
            <Card padding="lg" tone="strong" className="text-center text-sm text-(--text-2)">
              No datasets match "{query}". Try a different search.
            </Card>
          )}

          {/* ── Grid view ── */}
          {filtered.length > 0 && (viewMode === 'grid' && !compact) && (
            <div className="w-full grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => {
                const fresh = freshnessOf(d.created_at)
                return (
                  <Link key={d.id} to={`/datasets/${d.id}`} className="group block h-full">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-(--border-subtle) bg-(--surface-1) transition-all duration-(--duration-normal) hover:-translate-y-1 hover:border-(--border-focus) hover:shadow-[var(--shadow-lg),0_0_30px_hsl(214_100%_59%/0.08)]">
                      {/* Top accent (reveals on hover) */}
                      <div className="h-0.5 w-full bg-(--brand) transition-transform origin-left scale-x-0 group-hover:scale-x-100" />

                      <div className="flex flex-1 flex-col gap-3 p-5">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-(--text-3)" />
                            <CardEyebrow>{d.file_format.toUpperCase()}</CardEyebrow>
                          </div>
                          <StatusBadge tone={fresh.tone} dot className="text-[9px]">
                            {fresh.label}
                          </StatusBadge>
                        </div>

                        {/* Name */}
                        <h2 className="text-base font-bold tracking-tight text-(--text-1) group-hover:text-(--brand) transition-colors leading-snug">
                          {d.name}
                        </h2>
                        <p className="truncate font-mono text-[10px] text-(--text-3)" title={d.filename}>
                          {d.filename}
                        </p>

                        {/* Stats */}
                        <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-(--border-subtle) pt-4">
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-3)">Rows</dt>
                            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-(--text-1)">
                              {d.rows.toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--text-3)">Columns</dt>
                            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-(--text-1)">
                              {d.cols}
                            </dd>
                          </div>
                          <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-(--text-3)">
                            <Clock className="h-3 w-3" /> Added {formatDate(d.created_at)}
                          </div>
                        </dl>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── List / Sidebar view ── */}
          {filtered.length > 0 && (viewMode === 'list' || compact) && (
            <div className={`animate-fade-in-up ${compact ? 'px-0.5' : ''}`}>
              {compact ? (
                <div className="space-y-2 w-full min-w-0">
                  {filtered.map((d) => {
                    const fresh = freshnessOf(d.created_at)
                    return (
                      <Link
                        key={d.id}
                        to={`/datasets/${d.id}`}
                        className="group block w-full min-w-0 rounded-lg border border-(--border-subtle) bg-(--surface-1) p-3 transition-all hover:border-(--border-focus) hover:bg-(--surface-2)"
                      >
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-(--brand)" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-(--text-1) group-hover:text-(--brand) transition-colors" title={d.name}>
                                {d.name}
                              </p>
                              <p className="truncate font-mono text-[10px] text-(--text-3)" title={d.filename}>
                                {d.filename}
                              </p>
                            </div>
                          </div>
                          <StatusBadge tone={fresh.tone} dot className="text-[9px] shrink-0">
                            {fresh.label}
                          </StatusBadge>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-(--border-subtle) pt-2 text-[10px] text-(--text-3)">
                          <span className="font-mono">{d.rows.toLocaleString()} rows · {d.cols} cols</span>
                          <span className="font-semibold">{d.file_format.toUpperCase()}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <DataTable>
                  <THead>
                    <TR>
                      <TH className="w-8"></TH>
                      <TH>Dataset</TH>
                      <TH>Status</TH>
                      <TH align="right">Rows</TH>
                      <TH align="right">Cols</TH>
                      <TH align="right">Created</TH>
                      <TH className="w-8"></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filtered.map((d) => {
                      const fresh = freshnessOf(d.created_at)
                      const py = density === 'compact' ? 'py-2' : 'py-3'
                      return (
                        <TR key={d.id} className="group relative">
                          <TD className={py}>
                            <FileSpreadsheet className="h-4 w-4 text-(--text-3)" />
                          </TD>
                          <TD className={py}>
                            <Link to={`/datasets/${d.id}`} className="absolute inset-0" aria-label={`View ${d.name}`} />
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-(--text-1) group-hover:text-(--brand) transition-colors">{d.name}</span>
                              <span className="text-[10px] font-mono text-(--text-3) truncate max-w-50">{d.filename}</span>
                            </div>
                          </TD>
                          <TD className={py}>
                            <StatusBadge tone={fresh.tone} dot className="text-[9px]">{fresh.label}</StatusBadge>
                          </TD>
                          <TD align="right" numeric className={`${py} text-sm font-mono font-medium text-(--text-2)`}>
                            {d.rows.toLocaleString()}
                          </TD>
                          <TD align="right" numeric className={`${py} text-sm font-mono font-medium text-(--text-2)`}>
                            {d.cols}
                          </TD>
                          <TD align="right" className={`${py} text-xs text-(--text-3)`}>
                            {formatDate(d.created_at)}
                          </TD>
                          <TD className={py}>
                            <ChevronRight className="h-4 w-4 text-(--text-4) group-hover:text-(--text-1) transition-colors ml-auto" />
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </DataTable>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
