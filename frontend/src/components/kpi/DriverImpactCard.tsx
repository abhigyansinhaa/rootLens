import { useMemo, useState } from 'react'
import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, CardTitle, DataTable, TBody, TD, TH, THead, TR } from '../ui'
import { formatPct01, formatNumber } from './format'

type Row = AnalysisKpis['driver_impact']['per_driver'][0] & {
  importance_share?: number | null
}

export function DriverImpactCard({ kpis }: { kpis: AnalysisKpis }) {
  const rows: Row[] = useMemo(() => {
    const byFeat = Object.fromEntries((kpis.drivers ?? []).map((d) => [d.feature, d.share]))
    return (kpis.driver_impact.per_driver ?? []).map((p) => ({
      ...p,
      importance_share: byFeat[p.feature] ?? null,
    }))
  }, [kpis])

  const [sortBy, setSortBy] = useState<'revenue' | 'delta'>('revenue')

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
            Rollups show the combined effect of neutralizing each top driver. Use this to prioritize where to
            intervene first.
          </p>
        </div>
        <div className="flex gap-2">
          {sortBtn('revenue', 'Revenue')}
          {sortBtn('delta', 'Delta')}
        </div>
      </div>
      <div className="mt-5">
        <DataTable>
          <THead>
            <tr>
              <TH>Driver</TH>
              <TH align="right">Importance</TH>
              <TH align="right">Δ target</TH>
              <TH align="right">Rows crossing</TH>
              <TH align="right">Revenue shift</TH>
            </tr>
          </THead>
          <TBody>
            {sorted.map((r) => (
              <TR key={r.feature}>
                <TD mono>{r.feature}</TD>
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
              </TR>
            ))}
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
