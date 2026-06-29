import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import type { AnalysisKpis } from '../../types'
import { CardEyebrow, StatusBadge } from '../ui'
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
  return direction === 'decreases' ? '↓ lowers risk' : '↑ raises risk'
}

export function DriverImpactCard({
  kpis,
  directionByFeature,
  roiAssumptions,
  rawColumns,
  shapSummaryUrl,
  shapBeeswarmUrl,
  highlightFeature,
  onHighlightChange,
  searchInputRef,
}: {
  kpis: AnalysisKpis
  directionByFeature?: Record<string, string>
  roiAssumptions?: string
  rawColumns?: string[]
  shapSummaryUrl?: string | null
  shapBeeswarmUrl?: string | null
  highlightFeature?: string | null
  onHighlightChange?: (feature: string | null) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
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
  const [focusedIndex, setFocusedIndex] = useState(0)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sortBy === 'revenue') {
        return Math.abs(b.revenue_recoverable ?? 0) - Math.abs(a.revenue_recoverable ?? 0)
      }
      return Math.abs(b.delta_target_rate) - Math.abs(a.delta_target_rate)
    })
    return copy
  }, [rows, sortBy])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sorted.filter((r) => {
      const label = formatDriverLabel(r.feature, rawColumns).toLowerCase()
      const matchesSearch = !q || label.includes(q) || r.feature.toLowerCase().includes(q)
      const ctrl = controllabilityForFeature(r.feature)
      return matchesSearch && (ctrlFilter === 'all' || ctrl === ctrlFilter)
    })
  }, [sorted, searchQuery, ctrlFilter, rawColumns])

  const MAX_ROWS = 12
  const [showAllDrivers, setShowAllDrivers] = useState(false)
  const displayed = showAllDrivers ? filtered : filtered.slice(0, MAX_ROWS)

  useEffect(() => {
    if (highlightFeature) {
      const idx = displayed.findIndex((r) => r.feature === highlightFeature)
      if (idx >= 0 && idx !== focusedIndex) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFocusedIndex(idx)
      }
    }
  }, [highlightFeature, displayed, focusedIndex])

  const selectRow = useCallback(
    (feature: string) => {
      onHighlightChange?.(feature)
      rowRefs.current.get(feature)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [onHighlightChange],
  )

  if (!sorted.length) return null

  return (
    <div className="space-y-4" data-print-tier="2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Driver impact</CardEyebrow>
          <h2 className="mt-1 text-lg font-semibold text-(--text-1)">Ranked root causes</h2>
          <p className="mt-1 max-w-xl text-sm text-(--text-2)">
            Actionable drivers ranked by revenue or lift. Press j/k to navigate rows.
          </p>
        </div>
        <div className="flex gap-2">
          {(['revenue', 'delta'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                sortBy === key
                  ? 'bg-(--brand) text-white'
                  : 'bg-(--surface-2) text-(--text-2) hover:bg-(--surface-3)',
              ].join(' ')}
            >
              {key === 'revenue' ? 'By revenue' : 'By lift'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--text-3)" aria-hidden />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search drivers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md bg-(--surface-2) pl-8 pr-3 py-2 text-sm text-(--text-1) placeholder:text-(--text-3) outline-none focus:ring-2 focus:ring-(--brand)/40 transition-shadow"
            aria-label="Search drivers"
          />
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Filter by controllability">
          <Filter className="h-3.5 w-3.5 text-(--text-3) shrink-0" aria-hidden />
          {(['all', 'controllable', 'observational', 'mixed'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCtrlFilter(c)}
              aria-pressed={ctrlFilter === c}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
                ctrlFilter === c
                  ? 'bg-(--brand) text-white'
                  : 'bg-(--surface-2) text-(--text-3) hover:bg-(--surface-3) hover:text-(--text-2)',
              ].join(' ')}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-(--surface-1) overflow-hidden border border-(--border-subtle)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-(--text-3) bg-(--surface-2)/50">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3 hidden sm:table-cell">Direction</th>
                <th className="px-4 py-3 text-right">Lift</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Revenue</th>
                <th className="px-4 py-3 hidden lg:table-cell">Confidence</th>
                <th className="px-4 py-3 w-10" aria-label="Evidence" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, idx) => {
                const direction = directionForFeature(r.feature, directionByFeature)
                const ctrl = controllabilityForFeature(r.feature)
                const selected = highlightFeature === r.feature
                const dimmed = highlightFeature && !selected

                return (
                  <tr
                    key={r.feature}
                    ref={(el) => {
                      if (el) rowRefs.current.set(r.feature, el)
                      else rowRefs.current.delete(r.feature)
                    }}
                    data-driver-row={r.feature}
                    data-focused={focusedIndex === idx}
                    onClick={() => selectRow(r.feature)}
                    onMouseEnter={() => onHighlightChange?.(r.feature)}
                    onMouseLeave={() => onHighlightChange?.(null)}
                    className={[
                      'cursor-pointer transition-colors duration-120 border-l-[3px]',
                      selected
                        ? 'bg-(--surface-3) border-l-(--brand)'
                        : 'border-l-transparent hover:bg-(--surface-2)/80',
                      dimmed ? 'opacity-50' : 'opacity-100',
                      focusedIndex === idx && !selected ? 'bg-(--surface-2)/60' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 tabular-nums text-(--text-3)">{idx + 1}</td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <p className="font-semibold text-(--text-1) truncate">{formatDriverLabel(r.feature, rawColumns)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-(--text-3)">{categoryForDriver(r.feature)}</span>
                        <StatusBadge tone={ctrl === 'controllable' ? 'success' : ctrl === 'observational' ? 'default' : 'warning'} className="px-1 py-0 text-[10px] bg-transparent border-0">
                          {controllabilityBadgeLabel(ctrl)}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-(--text-2) text-xs">{dirLabel(direction)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPct01(Math.abs(r.delta_target_rate))}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums hidden md:table-cell">
                      {r.revenue_recoverable != null
                        ? `$${Math.abs(r.revenue_recoverable).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell capitalize text-(--text-2)">{r.confidence_tier ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEvidenceFeature(r.feature)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-(--surface-2) text-(--text-3) hover:text-(--brand) hover:bg-(--surface-3) transition-colors"
                        title="View evidence"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-sm text-(--text-3)">
          No drivers match your search.
        </div>
      )}

      {filtered.length > MAX_ROWS && (
        <div className="flex justify-center print:hidden">
          <button
            type="button"
            className="rounded-md bg-(--surface-2) px-5 py-2 text-xs font-medium text-(--text-2) hover:bg-(--surface-3) transition-colors"
            onClick={() => setShowAllDrivers((v) => !v)}
          >
            {showAllDrivers ? 'Show top drivers only' : `Show all ${filtered.length} drivers`}
          </button>
        </div>
      )}

      {roiAssumptions && (
        <div className="rounded-lg bg-(--surface-2)/60 p-4">
          <p className="text-xs font-medium text-(--text-3) mb-1">ROI assumptions</p>
          <p className="text-sm text-(--text-2) leading-relaxed">{roiAssumptions}</p>
        </div>
      )}

      {evidenceFeature && (
        <div className="fixed inset-0 z-50 flex justify-end print:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setEvidenceFeature(null)} />
          <div className="relative w-full max-w-2xl bg-(--app-bg) h-full shadow-(--shadow-overlay) overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 z-10 flex justify-between items-center bg-(--app-bg) border-b border-(--border-subtle) p-6">
              <div>
                <p className="text-xs font-medium text-(--brand) mb-1">Evidence</p>
                <h2 className="text-xl font-semibold text-(--text-1) pr-8">{formatDriverLabel(evidenceFeature, rawColumns)}</h2>
              </div>
              <button
                onClick={() => setEvidenceFeature(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-(--surface-2) text-(--text-2) hover:bg-(--surface-3)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-(--text-2) leading-relaxed">
                SHAP values show each feature&apos;s marginal contribution to the model prediction across this cohort.
              </p>
              {shapSummaryUrl && (
                <div className="rounded-lg bg-(--surface-1) p-4">
                  <CardEyebrow>Summary plot</CardEyebrow>
                  <AuthenticatedApiImage apiPath={shapSummaryUrl} alt="SHAP summary" className="max-w-full rounded-md mt-3 bg-white" />
                </div>
              )}
              {shapBeeswarmUrl && (
                <div className="rounded-lg bg-(--surface-1) p-4">
                  <CardEyebrow>Beeswarm plot</CardEyebrow>
                  <AuthenticatedApiImage apiPath={shapBeeswarmUrl} alt="SHAP beeswarm" className="max-w-full rounded-md mt-3 bg-white" />
                </div>
              )}
              {!shapSummaryUrl && !shapBeeswarmUrl && (
                <p className="text-sm text-(--text-3) text-center py-8">No visual evidence for this run.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export type DriverTableHandle = {
  focusSearch: () => void
  moveFocus: (dir: 1 | -1) => void
  getDisplayedFeatures: () => string[]
}
