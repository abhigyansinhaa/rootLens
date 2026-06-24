import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis } from '../../types'
import { CardEyebrow } from '../ui'
import { ChartTooltip, chartTooltipStyle } from '../ui'
import { formatCompactMoney, formatPct01 } from './format'

export function ConcentrationCallout({ kpis }: { kpis: AnalysisKpis }) {
  const h = kpis.concentration.headline
  const interpretation = kpis.concentration.interpretation

  const cutOptions = useMemo(() => {
    const paretoCuts = kpis.concentration.pareto_cuts ?? []
    if (paretoCuts.length) return paretoCuts
    const pts = kpis.concentration.lorenz_points ?? []
    return pts.map((p) => ({
      top_pct: p.x,
      share_of_risk: p.y,
      approx_users: Math.max(1, Math.round(p.x * kpis.target_level.n_users)),
      approx_revenue_at_risk:
        kpis.impact_revenue != null ? kpis.impact_revenue.revenue_at_risk * p.y : null,
    }))
  }, [
    kpis.concentration.pareto_cuts,
    kpis.concentration.lorenz_points,
    kpis.target_level.n_users,
    kpis.impact_revenue,
  ])

  const pts = kpis.concentration.lorenz_points ?? []
  const [idx, setIdx] = useState(0)
  const selected = cutOptions[Math.min(idx, Math.max(0, cutOptions.length - 1))]

  const annotationPoint = pts.find((p) => Math.abs(p.x - h.top_pct_users) < 0.02) ?? {
    x: h.top_pct_users,
    y: h.share_of_risk,
  }

  return (
    <div
      id="concentration-section"
      data-print-tier="2"
      className="rounded-lg bg-(--surface-1) p-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"
      style={{ boxShadow: 'var(--shadow-surface)' }}
    >
      <div className="max-w-md space-y-3">
        <CardEyebrow>Pareto concentration</CardEyebrow>
        <p className="text-xl font-semibold leading-tight text-(--text-1)">
          Top{' '}
          <span className="tabular-nums text-(--brand)">{(h.top_pct_users * 100).toFixed(0)}%</span>{' '}
          of users hold{' '}
          <span className="tabular-nums text-(--brand)">{formatPct01(h.share_of_risk)}</span>{' '}
          of expected exposure
        </p>
        {interpretation ? (
          <p className="text-sm leading-relaxed text-(--text-2)">{interpretation}</p>
        ) : (
          <p className="text-sm text-(--text-2)">
            Gini {kpis.concentration.gini.toFixed(2)} — higher values mean tail risk is more concentrated.
          </p>
        )}

        {cutOptions.length > 1 && (
          <div className="pt-2">
            <label className="text-xs font-medium text-(--text-3) block mb-2">
              Tail threshold — top {(selected?.top_pct ?? h.top_pct_users) * 100}%
            </label>
            <input
              type="range"
              min={0}
              max={cutOptions.length - 1}
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="w-full accent-(--brand)"
              aria-label="Pareto tail threshold"
            />
            {selected && (
              <dl className="mt-3 grid gap-1.5 text-sm text-(--text-2)">
                <div className="flex justify-between">
                  <dt>Share of exposure</dt>
                  <dd className="font-semibold tabular-nums text-(--text-1)">{formatPct01(selected.share_of_risk)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Approx. users</dt>
                  <dd className="font-semibold tabular-nums text-(--text-1)">{selected.approx_users.toLocaleString()}</dd>
                </div>
                {selected.approx_revenue_at_risk != null && (
                  <div className="flex justify-between">
                    <dt>Revenue in tail</dt>
                    <dd className="font-semibold tabular-nums text-(--text-1)">
                      {formatCompactMoney(selected.approx_revenue_at_risk)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full min-w-[240px] max-w-lg flex-col">
        <div className="h-52 w-full">
          {pts.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pts} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                <XAxis
                  dataKey="x"
                  tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      title="Lorenz curve"
                      value={payload?.[0] ? formatPct01(Number(payload[0].value)) : undefined}
                      context={
                        payload?.[0]?.payload?.x != null
                          ? `Top ${(Number(payload[0].payload.x) * 100).toFixed(0)}% of users`
                          : undefined
                      }
                    />
                  )}
                  contentStyle={chartTooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="var(--chart-primary)"
                  fill="var(--chart-primary)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
                <ReferenceDot
                  x={annotationPoint.x}
                  y={annotationPoint.y}
                  r={5}
                  fill="var(--brand)"
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                  label={{
                    value: `${formatPct01(h.share_of_risk)} risk`,
                    position: 'top',
                    fill: 'var(--text-2)',
                    fontSize: 11,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-(--text-3)">Not enough variance to plot.</p>
          )}
        </div>
      </div>
    </div>
  )
}
