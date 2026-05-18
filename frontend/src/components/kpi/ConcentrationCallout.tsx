import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, StatusBadge } from '../ui'
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
        kpis.impact_revenue != null
          ? kpis.impact_revenue.revenue_at_risk * p.y
          : null,
    }))
  }, [
    kpis.concentration.pareto_cuts,
    kpis.concentration.lorenz_points,
    kpis.target_level.n_users,
    kpis.impact_revenue,
  ])

  const pts = kpis.concentration.lorenz_points ?? []

  const paretoBars = useMemo(() => {
    if (cutOptions.length < 2) return []
    return cutOptions.map((c) => ({
      name: `${(c.top_pct * 100).toFixed(0)}%`,
      share: c.share_of_risk,
      users: c.approx_users,
    }))
  }, [cutOptions])

  const [idx, setIdx] = useState(0)
  const selected = cutOptions[Math.min(idx, Math.max(0, cutOptions.length - 1))]

  return (
    <Card padding="lg" tone="strong" className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-xl space-y-3">
        <div className="flex items-center gap-2">
          <CardEyebrow>Pareto concentration</CardEyebrow>
          <StatusBadge tone="info" dot>
            Risk lens
          </StatusBadge>
        </div>
        <p className="text-xl font-bold leading-tight text-[var(--text-1)]">
          Top{' '}
          <span className="tabular-nums text-brand-600 dark:text-brand-300">
            {(h.top_pct_users * 100).toFixed(0)}%
          </span>{' '}
          of users hold{' '}
          <span className="tabular-nums text-brand-600 dark:text-brand-300">
            {formatPct01(h.share_of_risk)}
          </span>{' '}
          of expected exposure
        </p>
        {interpretation ? (
          <p className="text-sm leading-6 text-[var(--text-2)]">{interpretation}</p>
        ) : (
          <p className="text-sm leading-6 text-[var(--text-2)]">
            Gini coefficient{' '}
            <span className="font-semibold tabular-nums text-[var(--text-1)]">
              {kpis.concentration.gini.toFixed(2)}
            </span>{' '}
            — the closer to 1.00, the more concentrated the modeled tail risk.
          </p>
        )}
        {cutOptions.length > 0 ? (
          <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-3 text-xs">
            <p className="font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Threshold simulation</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {cutOptions.map((c, i) => (
                <button
                  key={`${c.top_pct}-${i}`}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                    idx === i
                      ? 'bg-brand-600 text-white'
                      : 'border border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]'
                  }`}
                >
                  Top {(c.top_pct * 100).toFixed(0)}%
                </button>
              ))}
            </div>
            {selected ? (
              <dl className="mt-3 grid gap-1 text-[var(--text-2)]">
                <div className="flex justify-between gap-2">
                  <dt>Share of modeled exposure</dt>
                  <dd className="font-bold tabular-nums text-[var(--text-1)]">{formatPct01(selected.share_of_risk)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Approx. users in tail</dt>
                  <dd className="font-bold tabular-nums text-[var(--text-1)]">
                    {selected.approx_users.toLocaleString()}
                  </dd>
                </div>
                {selected.approx_revenue_at_risk != null && Number.isFinite(selected.approx_revenue_at_risk) ? (
                  <div className="flex justify-between gap-2">
                    <dt>Approx. revenue at risk (tail)</dt>
                    <dd className="font-bold tabular-nums text-[var(--text-1)]">
                      {formatCompactMoney(selected.approx_revenue_at_risk)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex w-full min-w-[220px] max-w-md flex-col gap-5">
        <div className="h-44 w-full">
          {pts.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pts} margin={{ left: -8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" className="opacity-60" />
                <XAxis
                  dataKey="x"
                  tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                />
                <Tooltip
                  formatter={(value) => [formatPct01(Number(value)), 'Share of risk']}
                  contentStyle={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-1)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: 'var(--text-1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="y"
                  stroke="var(--chart-primary)"
                  fill="var(--chart-primary)"
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[var(--text-3)]">Not enough variance to plot.</p>
          )}
        </div>
        {paretoBars.length >= 2 ? (
          <div className="h-36 w-full">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-3)]">
              Pareto cuts (share of risk by tail %)
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paretoBars} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" className="opacity-60" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as { users?: number } | undefined
                    const u = payload?.users
                    const suffix = u != null ? ` (~${u.toLocaleString()} users)` : ''
                    return [`${formatPct01(Number(value))}${suffix}`, 'Share of risk']
                  }}
                  contentStyle={{
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-1)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: 'var(--text-1)',
                  }}
                />
                <Bar dataKey="share" fill="var(--chart-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
