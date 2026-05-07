import {
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, StatusBadge } from '../ui'
import { formatPct01 } from './format'

export function ConcentrationCallout({ kpis }: { kpis: AnalysisKpis }) {
  const h = kpis.concentration.headline
  const pts = kpis.concentration.lorenz_points ?? []

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
        <p className="text-sm leading-6 text-[var(--text-2)]">
          Gini coefficient{' '}
          <span className="font-semibold tabular-nums text-[var(--text-1)]">
            {kpis.concentration.gini.toFixed(2)}
          </span>{' '}
          - the closer to 1.00, the more concentrated the modeled tail risk.
        </p>
      </div>
      <div className="h-44 w-full min-w-[220px] max-w-md">
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
    </Card>
  )
}
