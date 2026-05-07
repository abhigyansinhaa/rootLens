import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
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
} from '../components/ui'
import type { Dataset } from '../types'

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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const { data } = await api.get<Dataset[]>('/datasets')
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
    <div className="space-y-8">
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
        actions={<Button to="/upload">Upload dataset</Button>}
      />

      {isLoading && <LoadingState rows={4} />}

      {error && (
        <ErrorState
          message="We couldn't load your datasets. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      )}

      {data && data.length === 0 && (
        <EmptyState
          title="No datasets yet"
          description="Upload a CSV or Parquet file to create your first dataset and start an analysis."
          icon={
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          }
          action={<Button to="/upload">Upload dataset</Button>}
        />
      )}

      {data && data.length > 0 && (
        <>
          <Card padding="md" tone="strong">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="max-w-md flex-1">
                <Input
                  label="Search"
                  placeholder="Name, filename, or format…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <Select
                label="Sort by"
                id="sort-datasets"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="recent">Recently added</option>
                <option value="name">Name (A-Z)</option>
                <option value="rows">Row count</option>
              </Select>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card padding="lg" tone="strong" className="text-center text-sm text-[var(--text-2)]">
              No datasets match “{query}”. Try a different search.
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => {
                const fresh = bucketByFreshness(d.created_at)
                return (
                  <li key={d.id}>
                    <Link to={`/datasets/${d.id}`} className="block h-full">
                      <Card
                        padding="md"
                        elevated
                        tone="strong"
                        className="group flex h-full flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-brand-400/70 dark:hover:border-brand-700/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <CardEyebrow>{d.file_format.toUpperCase()}</CardEyebrow>
                          <StatusBadge tone={fresh.tone} dot>
                            {fresh.label}
                          </StatusBadge>
                        </div>
                        <h2 className="text-lg font-black tracking-tight text-[var(--text-1)]">
                          {d.name}
                        </h2>
                        <p
                          className="truncate font-mono text-[11px] text-[var(--text-3)]"
                          title={d.filename}
                        >
                          {d.filename}
                        </p>
                        <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--border-1)] pt-3 text-xs text-[var(--text-2)]">
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
                              Rows
                            </dt>
                            <dd className="mt-1 font-bold tabular-nums text-[var(--text-1)]">
                              {d.rows.toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
                              Columns
                            </dt>
                            <dd className="mt-1 font-bold tabular-nums text-[var(--text-1)]">
                              {d.cols.toLocaleString()}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-3)]">
                              Added
                            </dt>
                            <dd className="mt-1 text-[var(--text-2)]">{formatDate(d.created_at)}</dd>
                          </div>
                        </dl>
                      </Card>
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
