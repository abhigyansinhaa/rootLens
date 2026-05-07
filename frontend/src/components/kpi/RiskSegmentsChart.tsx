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
import { formatPct01 } from './format'

export function RiskSegmentsChart({ kpis, hasValue }: { kpis: AnalysisKpis; hasValue: boolean }) {
  const chart = kpis.risk_segments.map((s) => ({
    bucket: s.bucket.toUpperCase(),
    users_share: s.share,
    value_share: hasValue ? s.value_share ?? 0 : 0,
    count: s.count,
    easiest: s.easiest_to_fix ?? false,
  }))

  return (
    <Card padding="lg" tone="strong">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardEyebrow>Segmentation</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Risk segments by population and value</CardTitle>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">
            Compare where users sit versus where modeled monetary exposure concentrates.
          </p>
        </div>
        <StatusBadge tone={hasValue ? 'warning' : 'default'} dot>
          {hasValue ? 'Value linked' : 'Users only'}
        </StatusBadge>
      </div>
      <div className="mt-6 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ bottom: 8, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" className="opacity-60" />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
            <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: 'var(--text-3)' }}
            />
            <Tooltip
              formatter={(value, key) =>
                `${(Number(value) * 100).toFixed(1)}% ${
                  String(key ?? '') === 'users_share' ? 'of rows' : 'of value'
                }`
              }
              contentStyle={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-1)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--text-1)',
              }}
            />
            <Bar dataKey="users_share" name="Users" fill="var(--chart-neutral)" radius={[6, 6, 0, 0]} />
            {hasValue ? (
              <Bar dataKey="value_share" name="Value" fill="var(--chart-warning)" radius={[6, 6, 0, 0]} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
  return (
    <div className="rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone} dot>
          {segment.bucket}
        </StatusBadge>
        {segment.easiest_to_fix ? <StatusBadge tone="success">Highest tractability</StatusBadge> : null}
      </div>
      <dl className="mt-4 space-y-2 text-xs text-[var(--text-2)]">
        <div className="flex justify-between gap-2">
          <dt>Rows</dt>
          <dd className="font-bold tabular-nums text-[var(--text-1)]">{segment.count.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Population share</dt>
          <dd className="font-bold tabular-nums text-[var(--text-1)]">{formatPct01(segment.share)}</dd>
        </div>
        {hasValue ? (
          <div className="flex justify-between gap-2">
            <dt>Value share</dt>
            <dd className="font-bold tabular-nums text-[var(--text-1)]">
              {formatPct01(segment.value_share ?? 0)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt>Avg model score</dt>
          <dd className="font-bold tabular-nums text-[var(--text-1)]">
            {segment.avg_proba?.toFixed(3) ?? '-'}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-5 text-[var(--text-3)]">
        {segment.easiest_to_fix
          ? 'Balances sizable population and strong driver sensitivity - prioritize this wedge first.'
          : 'Drill into SHAP narratives for hypotheses on how to intervene.'}
      </p>
    </div>
  )
}
