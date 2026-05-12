import { useMemo, useState } from 'react'
import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, CardTitle, DataTable, Input, StatusBadge, TBody, TD, TH, THead, TR } from '../ui'
import { categoryForDriver, controllabilityBadgeLabel, controllabilityForFeature } from './driverMeta'
import { formatPct01, formatNumber } from './format'

type Row = AnalysisKpis['driver_impact']['per_driver'][0] & {
  importance_share?: number | null
}

function dirLabel(direction: string | undefined): string {
  if (!direction) return '—'
  return direction === 'decreases' ? '↓ churn risk' : '↑ churn risk'
}

function stabilityShort(signals: Record<string, unknown> | undefined): string {
  if (!signals) return '—'
  const cv = signals.cv_ratio
  const sup = signals.support
  if (typeof cv === 'number' && Number.isFinite(cv)) {
    return `cv ${cv.toFixed(2)}`
  }
  if (typeof sup === 'number') return `sup ${(sup * 100).toFixed(0)}%`
  return '—'
}

export function DriverImpactCard({
  kpis,
  directionByFeature,
}: {
  kpis: AnalysisKpis
  directionByFeature?: Record<string, string>
}) {
  const rows: Row[] = useMemo(() => {
    const byFeat = Object.fromEntries((kpis.drivers ?? []).map((d) => [d.feature, d.share]))
    return (kpis.driver_impact.per_driver ?? []).map((p) => ({
      ...p,
      importance_share: byFeat[p.feature] ?? null,
    }))
  }, [kpis])

  const [sortBy, setSortBy] = useState<'revenue' | 'delta'>('revenue')
  const [costs, setCosts] = useState<Record<string, string>>({})

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      if (sortBy === 'revenue') {
        return (b.revenue_recoverable ?? 0) - (a.revenue_recoverable ?? 0)
      }
      return Math.abs(b.delta_target_rate) - Math.abs(a.delta_target_rate)
    })
    return copy
  }, [rows, sortBy])

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
    <Card padding="lg" tone="strong">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardEyebrow>Driver impact scenario</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Top drivers, ranked by lift or revenue</CardTitle>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">
            Rollups show the combined effect of neutralizing each top driver. Cost and ROI below are editable for
            planning only (not saved).
          </p>
        </div>
        <div className="flex gap-2">
          {sortBtn('revenue', 'Revenue')}
          {sortBtn('delta', 'Delta')}
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <DataTable>
          <THead>
            <tr>
              <TH>Driver</TH>
              <TH>Category</TH>
              <TH>Control</TH>
              <TH>Effect</TH>
              <TH>Stability</TH>
              <TH align="right">Conf.</TH>
              <TH align="right">Importance</TH>
              <TH align="right">Δ target</TH>
              <TH align="right">Rows crossing</TH>
              <TH align="right">Revenue shift</TH>
              <TH align="right">Cost est.</TH>
              <TH align="right">ROI</TH>
            </tr>
          </THead>
          <TBody>
            {sorted.map((r) => {
              const stem = r.feature.includes('_') ? r.feature.split('_')[0] : r.feature
              const direction =
                directionByFeature?.[r.feature] ?? directionByFeature?.[stem] ?? directionByFeature?.[r.feature]
              const ctrl = controllabilityForFeature(stem)
              const tier = r.confidence_tier
              const costStr = costs[r.feature] ?? ''
              const costNum = parseFloat(costStr.replace(/[^0-9.-]/g, ''))
              const rev = r.revenue_recoverable
              const roi =
                rev != null && Number.isFinite(rev) && costNum > 0 && Number.isFinite(costNum)
                  ? Math.abs(rev) / costNum
                  : null

              return (
                <TR key={r.feature}>
                  <TD mono>{r.feature}</TD>
                  <TD className="whitespace-nowrap text-[11px] text-[var(--text-2)]">
                    {categoryForDriver(stem)}
                  </TD>
                  <TD>
                    <StatusBadge tone={ctrl === 'controllable' ? 'success' : ctrl === 'observational' ? 'default' : 'warning'}>
                      {controllabilityBadgeLabel(ctrl)}
                    </StatusBadge>
                  </TD>
                  <TD className="whitespace-nowrap text-xs font-semibold text-[var(--text-1)]">
                    {dirLabel(direction)}
                  </TD>
                  <TD className="text-[11px] text-[var(--text-3)]">{stabilityShort(r.confidence_signals)}</TD>
                  <TD align="right" className="text-[11px] uppercase">
                    {tier ?? '—'}
                  </TD>
                  <TD align="right" numeric>
                    {r.importance_share != null ? formatPct01(r.importance_share, 2) : '-'}
                  </TD>
                  <TD align="right" numeric>
                    {formatPct01(Math.abs(r.delta_target_rate))}
                  </TD>
                  <TD align="right" numeric>
                    {formatNumber(r.users_savable, 0)}
                  </TD>
                  <TD align="right" numeric>
                    {r.revenue_recoverable != null && Number.isFinite(r.revenue_recoverable)
                      ? `$${Math.abs(r.revenue_recoverable).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}`
                      : '-'}
                  </TD>
                  <TD align="right" className="min-w-[100px]">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="USD"
                      className="h-8 py-1 text-xs"
                      value={costStr}
                      onChange={(e) => setCosts((prev) => ({ ...prev, [r.feature]: e.target.value }))}
                    />
                  </TD>
                  <TD align="right" numeric className="text-xs font-bold tabular-nums">
                    {roi != null && Number.isFinite(roi) ? `${roi.toFixed(2)}x` : '—'}
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </DataTable>
      </div>
      <p className="mt-4 text-[11px] text-[var(--text-3)]">
        Scenario mode:{' '}
        <span className="font-bold uppercase tracking-wider text-[var(--text-2)]">
          {kpis.driver_impact.approximation.replace('_', ' ')}
        </span>
      </p>
    </Card>
  )
}
