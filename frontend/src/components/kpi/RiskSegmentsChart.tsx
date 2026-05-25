import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, CardTitle, StatusBadge } from '../ui'
import { formatCompactMoney, formatPct01 } from './format'
import { Target, TrendingUp, AlertTriangle } from 'lucide-react'

const BUCKET_LABEL: Record<AnalysisKpis['risk_segments'][0]['bucket'], string> = {
  low: 'Stable customers',
  medium: 'Watchlist accounts',
  high: 'Critical retention risk',
}

const PLAYBOOK: Record<AnalysisKpis['risk_segments'][0]['bucket'], string[]> = {
  low: ['Automated nurture and light-touch digital engagement.', 'Monitor monthly for sharp score spikes.'],
  medium: ['Blend digital offers with targeted outreach.', 'Test save desk scripts on the next billing cycle.'],
  high: [
    'Prioritize human outreach and executive sponsorship for large accounts.',
    'Bundle/discount options and long-term contract moves.',
  ],
}

export function RiskSegmentsChart({ kpis, hasValue }: { kpis: AnalysisKpis; hasValue: boolean }) {
  const chart = kpis.risk_segments.map((s) => ({
    bucket: BUCKET_LABEL[s.bucket],
    raw: s.bucket,
    users_share: s.share,
    value_share: hasValue ? s.value_share ?? 0 : 0,
    count: s.count,
    easiest: s.easiest_to_fix ?? false,
  }))

  return (
    <Card padding="xl" tone="strong" elevated className="border-t-[var(--border-subtle)] border-t-2 glass overflow-hidden relative">
      <div className="absolute top-0 right-0 -mt-24 -mr-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CardEyebrow>Segmentation Strategy</CardEyebrow>
          <CardTitle className="mt-2 text-2xl font-black tracking-tight text-[var(--text-1)]">Risk by Population and Value</CardTitle>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-2)]">
            Compare where your users sit versus where modeled monetary exposure concentrates. This helps prioritize interventions based on ROI.
          </p>
        </div>
        <StatusBadge tone={hasValue ? 'warning' : 'default'} dot className="px-3 py-1 text-xs">
          {hasValue ? 'Value linked' : 'Users only'}
        </StatusBadge>
      </div>

      <div className="mt-10 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ bottom: 8, left: -10 }}>
            <defs>
              <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-neutral)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--chart-neutral)" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-amber-500)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--color-amber-600)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" className="opacity-40" />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)', paddingTop: '16px' }} iconType="circle" />
            <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: 'var(--text-3)', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: 'var(--text-3)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, key) =>
                `${(Number(value) * 100).toFixed(1)}% ${
                  String(key ?? '') === 'users_share' ? 'of rows' : 'of value'
                }`
              }
              contentStyle={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--text-1)',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
              }}
              cursor={{ fill: 'var(--surface-3)', opacity: 0.4 }}
            />
            <Bar dataKey="users_share" name="Users" fill="url(#usersGradient)" radius={[6, 6, 0, 0]} barSize={40} />
            {hasValue ? (
              <Bar dataKey="value_share" name="Value" fill="url(#valueGradient)" radius={[6, 6, 0, 0]} barSize={40} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {kpis.risk_segments.map((segment) => (
          <SegmentTile key={segment.bucket} segment={segment} hasValue={hasValue} />
        ))}
      </div>
    </Card>
  )
}

function SegmentTile({
  segment,
  hasValue,
}: {
  segment: AnalysisKpis['risk_segments'][0]
  hasValue: boolean
}) {
  const tone = segment.bucket === 'high' ? 'risk' : segment.bucket === 'medium' ? 'warning' : 'success'
  const label = BUCKET_LABEL[segment.bucket]
  const playbook = PLAYBOOK[segment.bucket]
  const evPerUser =
    hasValue && segment.count > 0 && segment.value != null && Number.isFinite(segment.value)
      ? segment.value / segment.count
      : null

  const Icon = segment.bucket === 'high' ? AlertTriangle : segment.bucket === 'medium' ? Target : TrendingUp

  return (
    <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 shadow-sm transition-all hover:shadow-md ${tone === 'risk' ? 'border-red-500/20 bg-red-500/5' : tone === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Icon className={`h-4 w-4 ${tone === 'risk' ? 'text-red-500' : tone === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`} />
        <span className={`text-sm font-bold ${tone === 'risk' ? 'text-red-700 dark:text-red-400' : tone === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {label}
        </span>
        {segment.easiest_to_fix ? <StatusBadge tone="success" className="ml-auto scale-90 origin-right">Highest tractability</StatusBadge> : null}
      </div>

      <dl className="space-y-3 text-sm text-[var(--text-2)] mb-5">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
          <dt>Rows</dt>
          <dd className="font-bold tabular-nums text-[var(--text-1)]">{segment.count.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
          <dt>Population share</dt>
          <dd className="font-bold tabular-nums text-[var(--text-1)]">{formatPct01(segment.share)}</dd>
        </div>
        {hasValue ? (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
            <dt>Value share</dt>
            <dd className="font-bold tabular-nums text-[var(--text-1)]">
              {formatPct01(segment.value_share ?? 0)}
            </dd>
          </div>
        ) : null}
        {evPerUser != null ? (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
            <dt>Exp. value / user</dt>
            <dd className="font-bold tabular-nums text-[var(--text-1)]">{formatCompactMoney(evPerUser)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <dt>Avg model score</dt>
          <dd className="font-bold tabular-nums text-[var(--text-1)]">
            {segment.avg_proba?.toFixed(3) ?? '-'}
          </dd>
        </div>
      </dl>

      <div className="rounded-lg bg-[var(--surface-2)] p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">Recommendations</p>
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-[var(--text-1)]">
          {playbook.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
