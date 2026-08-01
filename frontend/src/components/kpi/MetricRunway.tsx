import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import type { Analysis, AnalysisKpis, KpiHistoryResponse } from '../../types'
import { StatusBadge } from '../ui'
import { formatDriverLabel } from '../../lib/driverLabels'
import { formatCompactMoney, formatNumber, formatPct01 } from './format'
import { TrendingUp, TrendingDown } from 'lucide-react'

function primaryRate(detail: Analysis, kpis: AnalysisKpis): { value: string; raw: number | null } {
  if (detail.task_type === 'regression') {
    const v = kpis.target_level.target_mean
    return v !== undefined ? { value: formatNumber(v, 4), raw: v } : { value: '—', raw: null }
  }
  const v = kpis.target_level.predicted_target_rate ?? kpis.target_level.target_rate
  return v !== undefined ? { value: formatPct01(v), raw: v } : { value: '—', raw: null }
}

function priorDelta(
  history: KpiHistoryResponse | undefined,
  detail: Analysis,
  kpis: AnalysisKpis,
): { text: string; trend: 'up' | 'down' | 'neutral' } {
  const pts = history?.points ?? []
  if (pts.length < 2) return { text: 'No prior run', trend: 'neutral' }

  if (detail.task_type === 'regression') {
    const a = pts[pts.length - 2].kpis.target_mean
    const b = pts[pts.length - 1].kpis.target_mean
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      const d = b - a
      return { text: `${formatNumber(Math.abs(d), 4)} vs prior`, trend: d >= 0 ? 'up' : 'down' }
    }
  } else {
    const pick = (p: (typeof pts)[0]['kpis']) => p.predicted_target_rate ?? p.target_rate ?? null
    const a = pick(pts[pts.length - 2].kpis)
    const b = pick(pts[pts.length - 1].kpis)
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      const d = b - a
      return { text: `${formatPct01(Math.abs(d))} vs prior`, trend: d >= 0 ? 'up' : 'down' }
    }
  }

  if (kpis.impact_revenue) {
    const a = pts[pts.length - 2].kpis.revenue_at_risk
    const b = pts[pts.length - 1].kpis.revenue_at_risk
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) {
      const d = b - a
      return {
        text: `${formatCompactMoney(Math.abs(d))} vs prior`,
        trend: d >= 0 ? 'up' : 'down',
      }
    }
  }
  return { text: '—', trend: 'neutral' }
}

function MetricCell({
  label,
  value,
  sub,
  subTone,
  delay,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  subTone?: 'up' | 'down' | 'neutral'
  delay?: number
}) {
  return (
    <div
      className="flex flex-col gap-1 px-6 py-5 first:pl-6 last:pr-6 animate-fade-in-up min-w-0"
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <p className="text-xs font-medium text-(--text-3)">{label}</p>
      <p className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-(--text-1) leading-none truncate">
        {value}
      </p>
      {sub && (
        <p
          className={[
            'text-xs font-medium tabular-nums flex items-center gap-1',
            subTone === 'up' ? 'text-(--critical)' : subTone === 'down' ? 'text-(--success)' : 'text-(--text-3)',
          ].join(' ')}
        >
          {subTone === 'up' && <TrendingUp className="h-3 w-3 shrink-0" />}
          {subTone === 'down' && <TrendingDown className="h-3 w-3 shrink-0" />}
          {sub}
        </p>
      )}
    </div>
  )
}

function Sparkline({ history, detail }: { history?: KpiHistoryResponse; detail: Analysis }) {
  const pts = history?.points ?? []
  const chartData = pts.slice(-6).map((p, i) => {
    const kp = p.kpis
    const val =
      detail.task_type === 'regression'
        ? (kp.target_mean ?? kp.predicted_mean ?? 0)
        : (kp.predicted_target_rate ?? kp.target_rate ?? 0)
    return { i, val }
  })

  if (chartData.length < 2) return null

  return (
    <div className="h-8 w-20 opacity-60 px-6 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis domain={['auto', 'auto']} hide />
          <Line
            type="monotone"
            dataKey="val"
            stroke="var(--brand)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MetricRunway({
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
  const rate = useMemo(() => primaryRate(detail, kpis), [detail, kpis])
  const delta = useMemo(() => priorDelta(history, detail, kpis), [history, detail, kpis])
  const revenue = kpis.impact_revenue?.revenue_at_risk
  const topDriver = kpis.drivers[0]
    ? formatDriverLabel(kpis.drivers[0].feature, rawColumns)
    : '—'
  const rel = kpis.reliability
  const relTone = rel.tier === 'high' ? 'success' : rel.tier === 'medium' ? 'warning' : 'risk'

  const rateLabel =
    detail.task_type === 'regression' ? `${detail.target} baseline` : `${detail.target} rate`

  return (
    <div
      data-print-tier="1"
      className="rounded-lg bg-(--surface-1) overflow-hidden border border-(--border-subtle)"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-y-0 lg:divide-x divide-(--border-subtle)">
        <MetricCell
          label={rateLabel}
          value={rate.value}
          sub={delta.text}
          subTone={delta.trend === 'neutral' ? 'neutral' : delta.trend}
          delay={0}
        />
        <div className="flex flex-col justify-center">
          <MetricCell
            label="Revenue at risk"
            value={revenue != null ? formatCompactMoney(revenue) : '—'}
            sub={
              revenue != null
                ? `${formatPct01(kpis.target_level.high_risk_share)} high-risk share`
                : 'No value column linked'
            }
            delay={40}
          />
          <Sparkline history={history} detail={detail} />
        </div>
        <MetricCell
          label="Top root cause"
          value={<span className="text-xl sm:text-2xl font-semibold">{topDriver}</span>}
          sub={kpis.drivers[0] ? `${formatPct01(kpis.drivers[0].share, 0)} importance` : undefined}
          delay={80}
        />
        <MetricCell
          label="Model confidence"
          value={
            <StatusBadge tone={relTone} dot className="text-sm capitalize px-0 bg-transparent border-0">
              {rel.tier}
            </StatusBadge>
          }
          sub={`${rel.headline_metric}: ${formatNumber(rel.headline_value)}`}
          delay={120}
        />
      </div>
    </div>
  )
}
