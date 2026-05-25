import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import {
  Button,
  Card,
  CardEyebrow,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '../../components/ui'
import { Database, Search, LayoutGrid, List, FileSpreadsheet, Clock, ArrowRight } from 'lucide-react'
import type { Dataset } from '../../types'

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

function bucketByFreshness(iso: string): { tone: 'success' | 'warning' | 'default'; label: string } {
  const ageMs = Date.now() - new Date(iso).getTime()
  const days = ageMs / (1000 * 60 * 60 * 24)
  if (days < 7) return { tone: 'success', label: 'Fresh' }
  if (days < 30) return { tone: 'default', label: 'Recent' }
  return { tone: 'warning', label: 'Stale' }
}

export function Datasets() {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name' | 'rows'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const { data } = await api.get<Dataset[]>('/datasets', { params: { limit: 500 } })
      return data
    },
  })

  const filtered = useMemo(() => {
    if (!data?.length) return []
    const q = query.trim().toLowerCase()
    const list = q
      ? data.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.filename.toLowerCase().includes(q) ||
            d.file_format.toLowerCase().includes(q),
        )
      : [...data]

    const sorted = [...list]
    if (sort === 'recent') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => b.rows - a.rows)
    }
    return sorted
  }, [data, query, sort])

  const totalRows = data?.reduce((s, d) => s + d.rows, 0) ?? 0
  const totalCols = data?.reduce((s, d) => s + d.cols, 0) ?? 0
  const formats = useMemo(() => {
    const set = new Set<string>()
    for (const d of data ?? []) set.add(d.file_format.toUpperCase())
    return Array.from(set)
  }, [data])

  return (
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        eyebrow="Data inventory"
        title="Datasets"
        description="Find uploaded tables, check freshness, and open a dataset to configure the next root-cause run."
        meta={
          data && data.length > 0 ? (
            <>
              <StatusBadge tone="info">{`${data.length} datasets`}</StatusBadge>
              <StatusBadge tone="default">{`${totalRows.toLocaleString()} rows`}</StatusBadge>
              <StatusBadge tone="default">{`${totalCols.toLocaleString()} columns`}</StatusBadge>
              {formats.map((f) => (
                <StatusBadge key={f} tone="neutral">
                  {f}
                </StatusBadge>
              ))}
            </>
          ) : null
        }
        actions={<Button to="/upload" className="bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/20">Upload dataset</Button>}
      />

      {isLoading && <LoadingState rows={4} />}

      {error && (
        <ErrorState
          message="We couldn't load your datasets. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      )}

      {data && data.length === 0 && (
        <div className="animate-fade-in-scale">
          <EmptyState
            title="No datasets yet"
            description="Upload a CSV or Parquet file to create your first dataset and start an analysis."
            icon={
              <div className="relative">
                <Database className="h-12 w-12 text-[var(--text-3)]" />
                <div className="absolute -bottom-2 -right-2 rounded-full bg-[var(--app-bg)] p-1">
                  <div className="rounded-full bg-brand-500 p-1 text-white shadow-lg shadow-brand-500/30 animate-pulse-glow">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            }
            action={<Button to="/upload" className="bg-brand-500 text-white">Upload dataset</Button>}
          />
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <Card padding="md" elevated className="glass sticky top-[calc(var(--app-header-height)+1rem)] z-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
              <div className="flex flex-1 items-end gap-4">
                <div className="relative w-full max-w-md group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] transition-colors group-focus-within:text-brand-500" />
                  <Input
                    label="Search"
                    placeholder="Name, filename, or format…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    className="pl-9 transition-all focus:ring-brand-500"
                  />
                </div>
                <Select
                  label="Sort by"
                  id="sort-datasets"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="w-40 shrink-0"
                >
                  <option value="recent">Recently added</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="rows">Row count</option>
                </Select>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-[var(--surface-1)] text-brand-600 shadow-sm dark:text-brand-400' 
                      : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-[var(--surface-1)] text-brand-600 shadow-sm dark:text-brand-400' 
                      : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card padding="lg" tone="strong" className="text-center text-sm text-[var(--text-2)] animate-fade-in-up">
              No datasets match “{query}”. Try a different search.
            </Card>
          ) : viewMode === 'grid' ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d, i) => {
                const fresh = bucketByFreshness(d.created_at)
                const toneColor = fresh.tone === 'success' ? 'emerald' : fresh.tone === 'warning' ? 'amber' : 'slate'
                return (
                  <li key={d.id} className={`animate-fade-in-up delay-${Math.min((i+1)*100, 500)}`}>
                    <Link to={`/datasets/${d.id}`} className="block h-full">
                      <Card
                        padding="none"
                        elevated
                        className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10 border-transparent hover:border-brand-500/30"
                      >
                        <div className={`h-1.5 w-full bg-${toneColor}-500 transition-transform origin-left scale-x-75 group-hover:scale-x-100`} />
                        <div className="flex h-full flex-col gap-3 p-5 bg-[var(--surface-1)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-[var(--text-3)]" />
                              <CardEyebrow>{d.file_format.toUpperCase()}</CardEyebrow>
                            </div>
                            <StatusBadge tone={fresh.tone} dot className="scale-90 origin-top-right">
                              {fresh.label}
                            </StatusBadge>
                          </div>
                          <h2 className="text-lg font-black tracking-tight text-[var(--text-1)] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {d.name}
                          </h2>
                          <p
                            className="truncate font-mono text-[11px] text-[var(--text-3)]"
                            title={d.filename}
                          >
                            {d.filename}
                          </p>
                          <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-2)]">
                            <div>
                              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
                                Rows
                              </dt>
                              <dd className="mt-1 font-mono font-semibold tabular-nums text-[var(--text-1)]">
                                {d.rows.toLocaleString()}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
                                Columns
                              </dt>
                              <dd className="mt-1 font-mono font-semibold tabular-nums text-[var(--text-1)]">
                                {d.cols.toLocaleString()}
                              </dd>
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5 mt-2">
                              <Clock className="h-3 w-3 text-[var(--text-3)]" />
                              <dd className="text-[10px] font-medium text-[var(--text-3)]">Added {formatDate(d.created_at)}</dd>
                            </div>
                          </dl>
                        </div>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((d, i) => {
                const fresh = bucketByFreshness(d.created_at)
                const toneColor = fresh.tone === 'success' ? 'bg-emerald-500' : fresh.tone === 'warning' ? 'bg-amber-500' : 'bg-slate-500'
                return (
                  <li key={d.id} className={`animate-slide-in-left delay-${Math.min((i+1)*50, 400)}`}>
                    <Link to={`/datasets/${d.id}`} className="block">
                      <div className="group relative overflow-hidden flex items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-all hover:border-brand-500/40 hover:bg-[var(--surface-2)]">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${toneColor} transition-all opacity-70 group-hover:opacity-100 group-hover:w-1.5`} />
                        <div className="flex min-w-0 flex-1 items-center gap-4 pl-2">
                          <FileSpreadsheet className="h-5 w-5 text-[var(--text-3)] shrink-0" />
                          <div className="min-w-0">
                            <h2 className="truncate font-bold text-[var(--text-1)] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                              {d.name}
                            </h2>
                            <p className="truncate font-mono text-[10px] text-[var(--text-3)] mt-0.5">
                              {d.filename}
                            </p>
                          </div>
                        </div>
                        <div className="hidden md:flex shrink-0 items-center gap-8 text-right font-mono text-xs text-[var(--text-2)] tabular-nums">
                          <div>
                            <span className="text-[var(--text-3)] mr-2">R</span>
                            {d.rows.toLocaleString()}
                          </div>
                          <div>
                            <span className="text-[var(--text-3)] mr-2">C</span>
                            {d.cols.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 text-right">
                          <span className="hidden sm:inline-block text-[11px] font-medium text-[var(--text-3)]">
                            {formatDate(d.created_at)}
                          </span>
                          <StatusBadge tone={fresh.tone} dot className="scale-90 origin-right shrink-0">
                            {fresh.label}
                          </StatusBadge>
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
