import { useMemo, useState } from 'react'
import type { Analysis, AnalysisKpis, KpiHistoryResponse } from '../../types'
import { HelpTooltip, StatusBadge } from '../ui'
import { formatDriverLabel } from '../../lib/driverLabels'
import { formatCompactMoney, formatNumber, formatPct01 } from './format'
import { Activity, ShieldCheck, Target, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'

function primaryMetric(detail: Analysis, kpis: AnalysisKpis): { label: string; value: string } {
  if (detail.task_type === 'regression') {
    return {
      label: 'Target baseline',
      value:
        kpis.target_level.target_mean !== undefined
          ? formatNumber(kpis.target_level.target_mean, 4)
          : 'No baseline',
    }
  }
  return {
    label: 'Churn / positive rate',
    value:
      kpis.target_level.target_rate !== undefined ? formatPct01(kpis.target_level.target_rate) : 'No baseline',
  }
}

function vsPriorLine(history: KpiHistoryResponse | undefined, kpis: AnalysisKpis): { text: string; trend: 'up' | 'down' | 'neutral' } {
  const pts = history?.points ?? []
  if (pts.length < 2) return { text: '—', trend: 'neutral' }
  const pickPred = (p: (typeof pts)[0]['kpis']) => p.predicted_target_rate ?? p.target_rate ?? null
  const aPred = pickPred(pts[pts.length - 2].kpis)
  const bPred = pickPred(pts[pts.length - 1].kpis)
  if (
    aPred != null &&
    bPred != null &&
    Number.isFinite(aPred) &&
    Number.isFinite(bPred)
  ) {
    const d = bPred - aPred
    return {
      text: `${formatPct01(Math.abs(d))} predicted vs prior`,
      trend: d < 0 ? 'down' : 'up'
    }
  }
  if (kpis.impact_revenue) {
    const a = pts[pts.length - 2].kpis.revenue_at_risk
    const b = pts[pts.length - 1].kpis.revenue_at_risk
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      const d = b - a
      return {
        text: `${formatCompactMoney(Math.abs(d))} revenue vs prior`,
        trend: d < 0 ? 'down' : 'up'
      }
    }
  }
  return { text: '—', trend: 'neutral' }
}

export function StickyExecutiveStrip({
  detail,
  kpis,
  history,
  rawColumns,
}: {
  detail: Analysis
  kpis: AnalysisKpis
  history?: KpiHistoryResponse
  rawColumns?: string[]
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const primary = useMemo(() => primaryMetric(detail, kpis), [detail, kpis])
  const compare = useMemo(() => vsPriorLine(history, kpis), [history, kpis])
  const r = kpis.reliability
  const iv = kpis.intervention_confidence
  const relTone = r.tier === 'high' ? 'success' : r.tier === 'medium' ? 'warning' : 'risk'
  const topDriver = kpis.drivers[0]
    ? formatDriverLabel(kpis.drivers[0].feature, rawColumns)
    : '—'

  return (
    <div
      className="sticky z-40 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-[var(--border-subtle)] bg-[var(--app-bg)]/80 backdrop-blur-xl shadow-sm transition-all print:shadow-none"
      style={{ top: 'var(--app-header-height, 64px)' }}
    >
      <div className="flex flex-col justify-center py-3">
        <div className="flex items-center justify-between gap-4">
          
          <div className="flex-1 md:flex-[1.5] min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-1">
              <Activity className="h-3.5 w-3.5 text-brand-500" /> {primary.label}
              <HelpTooltip title="Baseline target metric for this cohort on the completed run.">ⓘ</HelpTooltip>
            </p>
            <p className="truncate text-2xl md:text-3xl font-black tabular-nums tracking-tight text-[var(--text-1)]">
              {primary.value}
            </p>
          </div>

          <div className="hidden md:flex flex-1 items-center justify-between gap-6">
            
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--text-2)]" /> Reliability
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge tone={relTone} dot className="px-2 py-0.5 text-[10px]">
                  {r.tier}
                </StatusBadge>
                <span className="text-sm font-bold tabular-nums text-[var(--text-1)]">
                  {formatNumber(r.headline_value)} <span className="font-medium text-[var(--text-3)] text-xs">({r.headline_metric})</span>
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-2">
                <Target className="h-3.5 w-3.5 text-[var(--text-2)]" /> Top Driver
              </p>
              <p className="truncate font-mono text-sm font-bold text-brand-600 dark:text-brand-400" title={topDriver}>
                {topDriver}
              </p>
            </div>

            <div className="min-w-0 pr-4 border-r border-[var(--border-subtle)]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-2">
                Vs Prior Run
              </p>
              <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums text-[var(--text-1)]">
                {compare.trend === 'up' ? <TrendingUp className="h-4 w-4 text-red-500" /> : compare.trend === 'down' ? <TrendingDown className="h-4 w-4 text-emerald-500" /> : null}
                {compare.text}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-2">
                Intervention
              </p>
              <StatusBadge
                tone={
                  iv?.tier === 'high' ? 'success' : iv?.tier === 'low' ? 'risk' : iv?.tier === 'medium' ? 'warning' : 'default'
                }
                dot
                className="px-2 py-0.5 text-[10px]"
              >
                {iv?.tier ?? 'unknown'}
              </StatusBadge>
            </div>

          </div>

          <button
            type="button"
            className="md:hidden shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-[var(--surface-2)] text-[var(--text-2)]"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-4 animate-fade-in-up">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-1">Reliability</p>
              <div className="flex items-center gap-2">
                <StatusBadge tone={relTone} dot className="px-2 py-0.5 text-[10px]">{r.tier}</StatusBadge>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-1">Intervention</p>
              <StatusBadge
                tone={iv?.tier === 'high' ? 'success' : iv?.tier === 'low' ? 'risk' : iv?.tier === 'medium' ? 'warning' : 'default'}
                dot
                className="px-2 py-0.5 text-[10px]"
              >
                {iv?.tier ?? 'unknown'}
              </StatusBadge>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-1">Top Driver</p>
              <p className="font-mono text-sm font-bold text-brand-600 truncate">{topDriver}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-3)] mb-1">Vs Prior Run</p>
              <p className="text-sm font-bold">{compare.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
