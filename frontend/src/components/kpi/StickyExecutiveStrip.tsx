import { useMemo, useState } from 'react'
import type { Analysis, AnalysisKpis, KpiHistoryResponse } from '../../types'
import { HelpTooltip, StatusBadge } from '../ui'
import { formatCompactMoney, formatNumber, formatPct01 } from './format'

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

function vsPriorLine(history: KpiHistoryResponse | undefined, kpis: AnalysisKpis): string {
  const pts = history?.points ?? []
  if (pts.length < 2) return '—'
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
    const arrow = d < 0 ? '↓' : '↑'
    return `${arrow} ${formatPct01(Math.abs(d))} predicted vs prior`
  }
  if (kpis.impact_revenue) {
    const a = pts[pts.length - 2].kpis.revenue_at_risk
    const b = pts[pts.length - 1].kpis.revenue_at_risk
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      const d = b - a
      const arrow = d < 0 ? '↓' : '↑'
      return `${arrow} ${formatCompactMoney(Math.abs(d))} revenue vs prior`
    }
  }
  return '—'
}

export function StickyExecutiveStrip({
  detail,
  kpis,
  history,
}: {
  detail: Analysis
  kpis: AnalysisKpis
  history?: KpiHistoryResponse
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const primary = useMemo(() => primaryMetric(detail, kpis), [detail, kpis])
  const compareText = useMemo(() => vsPriorLine(history, kpis), [history, kpis])
  const r = kpis.reliability
  const iv = kpis.intervention_confidence
  const relTone = r.tier === 'high' ? 'success' : r.tier === 'medium' ? 'warning' : 'risk'
  const topDriver = kpis.drivers[0]?.feature ?? '—'

  return (
    <div
      className="sticky z-30 border-b border-[var(--border-soft)] bg-[var(--surface-1)]/95 shadow-[var(--shadow-soft)] backdrop-blur-md print:shadow-none"
      style={{ top: 'var(--app-header-height, 64px)' }}
    >
      <div className="flex min-h-[72px] flex-col justify-center gap-2 py-2 md:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 md:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-3)]">
              {primary.label}
            </p>
            <p className="truncate text-2xl font-black tabular-nums text-[var(--text-1)] sm:text-3xl">
              {primary.value}
            </p>
          </div>
          <button
            type="button"
            className="print:hidden shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--text-2)]"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? 'Less' : 'Summary'}
          </button>
        </div>

        <div
          className={`${mobileOpen ? 'flex' : 'hidden'} flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-y-2`}
        >
          <div className="hidden min-w-[140px] flex-[1.2] md:block">
            <p className="flex items-center gap-1 text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-3)]">
              {primary.label}
              <HelpTooltip title="Baseline target metric for this cohort on the completed run.">ⓘ</HelpTooltip>
            </p>
            <p className="mt-0.5 text-[length:var(--font-kpi-xl)] font-black leading-none tabular-nums text-[var(--text-1)]">
              {primary.value}
            </p>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-start lg:justify-end lg:gap-6">
            <div className="min-w-[100px]">
              <p className="text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-3)]">
                Reliability
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge tone={relTone} dot className="text-[10px]">
                  {r.tier}
                </StatusBadge>
                <span className="text-xs font-semibold tabular-nums text-[var(--text-2)]">
                  {formatNumber(r.headline_value)}{' '}
                  <span className="font-normal uppercase tracking-wider text-[var(--text-3)]">
                    ({r.headline_metric})
                  </span>
                </span>
              </div>
            </div>

            <div className="min-w-[100px]">
              <p className="text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-3)]">
                Intervention
              </p>
              <div className="mt-1">
                <StatusBadge
                  tone={
                    iv?.tier === 'high'
                      ? 'success'
                      : iv?.tier === 'low'
                        ? 'risk'
                        : iv?.tier === 'medium'
                          ? 'warning'
                          : 'default'
                  }
                  dot
                  className="text-[10px]"
                >
                  {iv?.tier ?? 'unknown'}
                </StatusBadge>
              </div>
            </div>

            <div className="min-w-[120px]">
              <p className="text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-3)]">
                Top driver
              </p>
              <p
                className="mt-1 truncate font-mono text-xs font-bold text-brand-700 dark:text-brand-300"
                title={topDriver}
              >
                {topDriver}
              </p>
            </div>

            <div className="min-w-[120px]">
              <p className="text-[length:var(--font-label-xs)] font-black uppercase tracking-[0.14em] text-[var(--text-3)]">
                vs prior run
              </p>
              <p className="mt-1 text-xs font-semibold tabular-nums text-[var(--text-2)]">{compareText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
