import { useMemo, useState } from 'react'
import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, StatusBadge } from '../ui'
import { directionForFeature, formatDriverLabel } from '../../lib/driverLabels'
import { categoryForDriver, controllabilityBadgeLabel, controllabilityForFeature } from './driverMeta'
import { formatPct01 } from './format'
import { AuthenticatedApiImage } from '../AuthenticatedApiImage'
import { X, ChevronRight, Search, Filter } from 'lucide-react'

type Row = AnalysisKpis['driver_impact']['per_driver'][0] & {
  importance_share?: number | null
}

function dirLabel(direction: string | undefined): string {
  if (!direction) return '—'
  return direction === 'decreases' ? '↓ churn risk' : '↑ churn risk'
}

export function DriverImpactCard({
  kpis,
  directionByFeature,
  roiAssumptions,
  rawColumns,
  shapSummaryUrl,
  shapBeeswarmUrl,
  highlightFeature,
}: {
  kpis: AnalysisKpis
  directionByFeature?: Record<string, string>
  roiAssumptions?: string
  rawColumns?: string[]
  shapSummaryUrl?: string | null
  shapBeeswarmUrl?: string | null
  highlightFeature?: string | null
}) {
  const rows: Row[] = useMemo(() => {
    const byFeat = Object.fromEntries((kpis.drivers ?? []).map((d) => [d.feature, d.share]))
    return (kpis.driver_impact.per_driver ?? []).map((p) => ({
      ...p,
      importance_share: byFeat[p.feature] ?? null,
    }))
  }, [kpis])

  const [sortBy, setSortBy] = useState<'revenue' | 'delta'>('revenue')
  const [evidenceFeature, setEvidenceFeature] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [ctrlFilter, setCtrlFilter] = useState<'all' | 'controllable' | 'observational' | 'mixed'>('all')

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sortBy === 'revenue') {
        const ra = Math.abs(a.revenue_recoverable ?? 0)
        const rb = Math.abs(b.revenue_recoverable ?? 0)
        return rb - ra
      }
      return Math.abs(b.delta_target_rate) - Math.abs(a.delta_target_rate)
    })
    return copy
  }, [rows, sortBy])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sorted.filter(r => {
      const label = formatDriverLabel(r.feature, rawColumns).toLowerCase()
      const matchesSearch = !q || label.includes(q) || r.feature.toLowerCase().includes(q)
      const ctrl = controllabilityForFeature(r.feature)
      const matchesCtrl = ctrlFilter === 'all' || ctrl === ctrlFilter
      return matchesSearch && matchesCtrl
    })
  }, [sorted, searchQuery, ctrlFilter, rawColumns])

  const MAX_ROWS = 12
  const [showAllDrivers, setShowAllDrivers] = useState(false)
  const displayed = showAllDrivers ? filtered : filtered.slice(0, MAX_ROWS)

  if (!sorted.length) {
    return null
  }

  const sortBtn = (key: 'revenue' | 'delta', label: string) => (
    <button
      type="button"
      onClick={() => setSortBy(key)}
      className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${
        sortBy === key
          ? 'bg-brand-600 text-white shadow-sm'
          : 'border border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--border-2)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardEyebrow>Driver impact scenario</CardEyebrow>
          <h2 className="mt-2 text-lg font-bold text-[var(--text-1)]">Top drivers, ranked by lift or revenue</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">
            Review the actionable drivers below. Rollups show the combined effect of neutralizing each top driver.
          </p>
        </div>
        <div className="flex gap-2">
          {sortBtn('revenue', 'Revenue')}
          {sortBtn('delta', 'Delta')}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search box */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-3)]" aria-hidden />
          <input
            type="search"
            placeholder="Search drivers…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={[
              'w-full rounded-[var(--radius-md)] border border-[var(--border-default)]',
              'bg-[var(--surface-2)] pl-8 pr-3 py-2 text-sm text-[var(--text-1)]',
              'placeholder:text-[var(--text-3)] outline-none',
              'focus:border-[var(--border-brand)] focus:ring-1 focus:ring-[var(--border-brand)]',
              'transition-colors',
            ].join(' ')}
            aria-label="Search drivers"
          />
        </div>

        {/* Controllability filter chips */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Filter by controllability">
          <Filter className="h-3.5 w-3.5 text-[var(--text-3)] shrink-0" aria-hidden />
          {(['all', 'controllable', 'observational', 'mixed'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCtrlFilter(c)}
              aria-pressed={ctrlFilter === c}
              className={[
                'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
                ctrlFilter === c
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-3)] hover:border-[var(--border-default)] hover:text-[var(--text-2)]',
              ].join(' ')}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        {/* Result count */}
        {(searchQuery || ctrlFilter !== 'all') && (
          <span className="text-xs text-[var(--text-3)] ml-auto">
            {filtered.length} of {sorted.length} drivers
            {(searchQuery || ctrlFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setCtrlFilter('all') }}
                className="ml-2 text-[var(--brand)] hover:underline font-semibold"
              >
                Clear ×
              </button>
            )}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((r) => {
          const direction = directionForFeature(r.feature, directionByFeature)
          const ctrl = controllabilityForFeature(r.feature)
          const tier = r.confidence_tier

          return (
            <Card
              key={r.feature}
              padding="lg"
              tone="strong"
              elevated
              className={[
                'flex flex-col border transition-all duration-300 scroll-mt-24',
                highlightFeature === r.feature
                  ? 'border-[var(--brand)] shadow-[var(--shadow-glow-lg)] bg-[var(--surface-2)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
              ].join(' ')}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                  {categoryForDriver(r.feature)}
                </span>
                <StatusBadge tone={ctrl === 'controllable' ? 'success' : ctrl === 'observational' ? 'default' : 'warning'}>
                  {controllabilityBadgeLabel(ctrl)}
                </StatusBadge>
              </div>
              
              <h3 className="text-lg font-bold text-brand-600 dark:text-brand-400 mb-1 line-clamp-2" title={formatDriverLabel(r.feature, rawColumns)}>
                {formatDriverLabel(r.feature, rawColumns)}
              </h3>
              <p className="text-sm font-medium text-[var(--text-1)] mb-6">
                {dirLabel(direction)}
              </p>
              
              <div className="mt-auto grid grid-cols-2 gap-4 border-t border-[var(--border-soft)] pt-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1">Lift (Δ target)</p>
                  <p className="font-bold tabular-nums text-[var(--text-1)]">{formatPct01(Math.abs(r.delta_target_rate))}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1">Revenue Shift</p>
                  <p className="font-bold tabular-nums text-[var(--text-1)]">
                    {r.revenue_recoverable != null ? `$${Math.abs(r.revenue_recoverable).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1">Confidence</p>
                  <p className="font-bold uppercase text-[var(--text-1)]">{tier ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-1">Importance</p>
                  <p className="font-bold tabular-nums text-[var(--text-1)]">{r.importance_share != null ? formatPct01(r.importance_share, 2) : '-'}</p>
                </div>
              </div>
              
              <div className="-mx-6 -mb-6 mt-6 border-t border-[var(--border-soft)]">
                <button 
                  onClick={() => setEvidenceFeature(r.feature)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-[var(--text-2)] hover:text-brand-600 hover:bg-brand-500/5 transition-colors rounded-b-xl"
                >
                  View Evidence <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-[var(--text-3)]">
          No drivers match your search.
          <button onClick={() => { setSearchQuery(''); setCtrlFilter('all') }} className="ml-2 text-[var(--brand)] hover:underline font-semibold">Clear filters</button>
        </div>
      )}

      {/* Show all toggle */}
      {filtered.length > MAX_ROWS && (
        <div className="mt-6 flex justify-center print:hidden">
          <button
            type="button"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-colors shadow-sm"
            onClick={() => setShowAllDrivers((v) => !v)}
          >
            {showAllDrivers ? 'Show top drivers only' : `Show all ${filtered.length} drivers`}
          </button>
        </div>
      )}


      {roiAssumptions ? (
        <div className="mt-8 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)]/40 p-5">
          <p className="text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-3)]">
            ROI assumptions
          </p>
          <p className="mt-2 text-[length:var(--font-body-md)] leading-relaxed text-[var(--text-2)]">{roiAssumptions}</p>
        </div>
      ) : null}

      {/* Evidence Drawer */}
      {evidenceFeature && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setEvidenceFeature(null)} />
          <div className="relative w-full max-w-2xl bg-[var(--app-bg)] h-full shadow-2xl overflow-y-auto animate-slide-in-right border-l border-[var(--border-strong)]">
            <div className="sticky top-0 z-10 flex justify-between items-center bg-[var(--app-bg)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">Evidence Drawer</p>
                <h2 className="text-xl font-bold leading-tight text-[var(--text-1)] pr-8">{formatDriverLabel(evidenceFeature, rawColumns)}</h2>
              </div>
              <button 
                onClick={() => setEvidenceFeature(null)} 
                className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-5">
                <p className="text-sm font-medium text-brand-800 dark:text-brand-300 leading-relaxed">
                  SHAP (SHapley Additive exPlanations) values show the marginal contribution of each feature to the model's prediction. 
                  The plots below visualize these effects globally across the dataset.
                </p>
              </div>
              
              {shapSummaryUrl ? (
                <Card padding="lg" tone="strong" elevated>
                  <CardEyebrow>Summary Plot</CardEyebrow>
                  <p className="mt-1 text-xs text-[var(--text-2)] mb-4">Shows feature importance and the direction of the relationship.</p>
                  <AuthenticatedApiImage 
                    apiPath={shapSummaryUrl} 
                    alt="SHAP summary" 
                    className="max-w-full rounded-lg border border-[var(--border-subtle)] bg-white mix-blend-luminosity hover:mix-blend-normal transition-all duration-300" 
                  />
                </Card>
              ) : null}
              
              {shapBeeswarmUrl ? (
                <Card padding="lg" tone="strong" elevated>
                  <CardEyebrow>Beeswarm Plot</CardEyebrow>
                  <p className="mt-1 text-xs text-[var(--text-2)] mb-4">Reveals the distribution of SHAP values for top drivers, showing exactly how high and low feature values impact predictions.</p>
                  <AuthenticatedApiImage 
                    apiPath={shapBeeswarmUrl} 
                    alt="SHAP beeswarm" 
                    className="max-w-full rounded-lg border border-[var(--border-subtle)] bg-white mix-blend-luminosity hover:mix-blend-normal transition-all duration-300" 
                  />
                </Card>
              ) : null}

              {!shapSummaryUrl && !shapBeeswarmUrl && (
                <div className="py-12 text-center text-[var(--text-3)]">
                  <p>No visual evidence available for this run.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
