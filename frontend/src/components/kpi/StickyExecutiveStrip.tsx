import { useMemo } from 'react'
import type { Analysis, AnalysisKpis, KpiHistoryResponse } from '../../types'
import { StatusBadge } from '../ui'
import { formatDriverLabel } from '../../lib/driverLabels'
import { formatCompactMoney, formatNumber, formatPct01 } from './format'

function stripMetrics(
  detail: Analysis,
  kpis: AnalysisKpis,
  rawColumns?: string[],
  history?: KpiHistoryResponse,
) {
  const isRegression = detail.task_type === 'regression'
  const rate =
    isRegression
      ? kpis.target_level.target_mean
      : (kpis.target_level.predicted_target_rate ?? kpis.target_level.target_rate)

  const rateLabel = isRegression ? 'Baseline' : 'Rate'
  const rateStr =
    rate != null
      ? isRegression
        ? formatNumber(rate, 4)
        : formatPct01(rate)
      : '—'

  const revenue = kpis.impact_revenue?.revenue_at_risk
  const topDriver = kpis.drivers[0]
    ? formatDriverLabel(kpis.drivers[0].feature, rawColumns)
    : '—'

  const rel = kpis.reliability
  const relTone: 'success' | 'warning' | 'risk' =
    rel.tier === 'high' ? 'success' : rel.tier === 'medium' ? 'warning' : 'risk'

  let vsPrior = '—'
  const pts = history?.points ?? []
  if (pts.length >= 2) {
    if (!isRegression) {
      const pick = (p: (typeof pts)[0]['kpis']) => p.predicted_target_rate ?? p.target_rate ?? null
      const a = pick(pts[pts.length - 2].kpis)
      const b = pick(pts[pts.length - 1].kpis)
      if (a != null && b != null) vsPrior = `${b >= a ? '↑' : '↓'}${formatPct01(Math.abs(b - a))}`
    } else if (revenue != null) {
      const a = pts[pts.length - 2].kpis.revenue_at_risk
      const b = pts[pts.length - 1].kpis.revenue_at_risk
      if (a != null && b != null) vsPrior = `${b >= a ? '↑' : '↓'}${formatCompactMoney(Math.abs(b - a))}`
    }
  }

  return { rateLabel, rateStr, revenue, topDriver, rel, relTone, vsPrior }
}

export function StickyExecutiveStrip({
  detail,
  kpis,
  history,
  rawColumns,
  onExport,
}: {
  detail: Analysis
  kpis: AnalysisKpis
  history?: KpiHistoryResponse
  rawColumns?: string[]
  onExport?: () => void
}) {
  const m = useMemo(
    () => stripMetrics(detail, kpis, rawColumns, history),
    [detail, kpis, rawColumns, history],
  )

  const items = [
    { label: m.rateLabel, value: m.rateStr, extra: m.vsPrior !== '—' ? m.vsPrior : null },
    {
      label: 'Rev at risk',
      value: m.revenue != null ? formatCompactMoney(m.revenue) : '—',
      extra: null,
    },
    { label: 'Top driver', value: m.topDriver, extra: null, mono: true },
    {
      label: 'Confidence',
      value: (
        <StatusBadge tone={m.relTone} dot className="px-0 py-0 text-xs capitalize bg-transparent border-0">
          {m.rel.tier}
        </StatusBadge>
      ),
      extra: null,
    },
  ]

  return (
    <div
      className="sticky z-40 -mx-4 px-4 sm:mx-0 sm:px-0 bg-(--surface-1) border-b border-(--border-subtle) transition-all print:hidden"
      style={{ top: 'var(--app-header-height, 60px)' }}
    >
      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap no-scrollbar py-2.5">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-4 shrink-0">
            {i > 0 && <div className="h-4 w-px bg-(--border-subtle) hidden sm:block" aria-hidden />}
            <div className="flex items-center gap-2">
              <span className="text-xs text-(--text-3)">{item.label}</span>
              <span
                className={[
                  'text-sm font-semibold tabular-nums text-(--text-1)',
                  item.mono ? 'font-mono text-xs max-w-[140px] truncate' : '',
                ].join(' ')}
                title={typeof item.value === 'string' ? item.value : undefined}
              >
                {item.value}
              </span>
              {item.extra && (
                <span className="text-xs font-medium text-(--text-3) tabular-nums">{item.extra}</span>
              )}
            </div>
          </div>
        ))}
        
        {onExport && (
          <div className="ml-auto pl-4 border-l border-(--border-subtle) hidden sm:block">
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 rounded-md bg-(--surface-2) px-2.5 py-1 text-xs font-semibold text-(--text-2) transition-colors hover:bg-(--surface-3) hover:text-(--text-1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
