import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis } from '../../types'
import { CardEyebrow, StatusBadge } from '../ui'
import { ChartTooltip, chartTooltipStyle } from '../ui'
import { formatPct01 } from './format'
import { chartPalette } from '../../lib/chartPalette'

const BUCKET_LABEL: Record<AnalysisKpis['risk_segments'][0]['bucket'], string> = {
  low: 'Stable',
  medium: 'Watchlist',
  high: 'Critical',
}

const BUCKET_TONE: Record<AnalysisKpis['risk_segments'][0]['bucket'], 'success' | 'warning' | 'risk'> = {
  low: 'success',
  medium: 'warning',
  high: 'risk',
}

export function RiskSegmentsChart({ kpis, hasValue }: { kpis: AnalysisKpis; hasValue: boolean }) {
  const chart = kpis.risk_segments.map((s) => ({
    bucket: BUCKET_LABEL[s.bucket],
    raw: s.bucket,
    users_share: s.share,
    value_share: hasValue ? s.value_share ?? 0 : 0,
    count: s.count,
  }))

  return (
    <div
      data-print-tier="2"
      className="rounded-lg bg-(--surface-1) p-6 overflow-hidden border border-(--border-subtle)"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <CardEyebrow>Risk segmentation</CardEyebrow>
          <h2 className="mt-1 text-lg font-semibold text-(--text-1)">Population vs value exposure</h2>
          <p className="mt-1 text-sm text-(--text-2) max-w-xl">
            Where users sit versus where monetary exposure concentrates.
          </p>
        </div>
        <StatusBadge tone={hasValue ? 'warning' : 'default'} dot>
          {hasValue ? 'Value linked' : 'Users only'}
        </StatusBadge>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ bottom: 4, left: -8, right: 8 }}>
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 12, fill: 'var(--text-3)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: 'var(--text-3)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                const row = payload?.[0]?.payload as { count?: number; users_share?: number } | undefined
                return (
                  <ChartTooltip
                    active={active}
                    title={String(label ?? '')}
                    value={
                      payload?.[0]
                        ? `${(Number(payload[0].value) * 100).toFixed(1)}%`
                        : undefined
                    }
                    context={row?.count != null ? `${row.count.toLocaleString()} users` : undefined}
                  />
                )
              }}
              contentStyle={chartTooltipStyle}
              cursor={{ fill: 'var(--surface-3)', opacity: 0.35 }}
            />
            <Bar dataKey="users_share" name="Users" fill={chartPalette[2]} radius={[6, 6, 0, 0]} barSize={36} />
            {hasValue && (
              <Bar dataKey="value_share" name="Value" fill={chartPalette[4]} radius={[6, 6, 0, 0]} barSize={36} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {kpis.risk_segments.map((segment) => (
          <div
            key={segment.bucket}
            className="flex-1 min-w-[140px] rounded-lg bg-(--surface-2)/80 px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge tone={BUCKET_TONE[segment.bucket]} dot className="px-0 bg-transparent border-0 capitalize text-xs">
                {BUCKET_LABEL[segment.bucket]}
              </StatusBadge>
              {segment.easiest_to_fix && (
                <span className="text-[10px] text-(--success) font-medium">Tractable</span>
              )}
            </div>
            <p className="text-lg font-semibold tabular-nums text-(--text-1)">{formatPct01(segment.share)}</p>
            <p className="text-xs text-(--text-3)">{segment.count.toLocaleString()} rows</p>
            {hasValue && segment.value_share != null && (
              <p className="text-xs text-(--text-2) mt-0.5">{formatPct01(segment.value_share)} of value</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
