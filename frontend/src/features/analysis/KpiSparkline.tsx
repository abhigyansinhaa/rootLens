import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import { api } from '../../api/client'
import type { DriverImpactRollup, KpiHistoryResponse } from '../../types'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { formatPct01 } from '../../components/kpi/format'

interface KpiSparklineProps {
  datasetId: number
  target: string
  kpiSummary?: { top2_impact?: DriverImpactRollup } | null
}

export function KpiSparkline({ datasetId, target, kpiSummary }: KpiSparklineProps) {
  const { data } = useQuery({
    queryKey: ['kpi-history', datasetId, target],
    queryFn: async () => {
      const { data: h } = await api.get<KpiHistoryResponse>(`/datasets/${datasetId}/kpi-history`, {
        params: { target }
      })
      return h
    },
    staleTime: 60_000,
  })

  const delta = kpiSummary?.top2_impact?.delta_target_rate
  const pts = data?.points ?? []
  
  // Need at least 2 points for a meaningful sparkline, but we'll show what we have.
  // Extract up to the last 3 predicted target rates.
  const chartData = pts.slice(-3).map((p, i) => ({
    i,
    val: p.kpis.predicted_target_rate ?? p.kpis.target_rate ?? 0
  }))

  const hasData = chartData.length > 1

  return (
    <div className="flex items-center gap-3 shrink-0">
      {hasData && (
        <div className="h-6 w-16 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <YAxis domain={['auto', 'auto']} hide />
              <Line
                type="monotone"
                dataKey="val"
                stroke="var(--text-3)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {delta != null && (
        <div className={[
          'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide',
          delta < 0 ? 'bg-(--c-success-bg) text-(--c-success) border border-(--c-success-border)' 
                    : 'bg-(--c-danger-bg) text-(--c-danger) border border-(--c-danger-border)'
        ].join(' ')}>
          {delta < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {formatPct01(Math.abs(delta))}
        </div>
      )}
    </div>
  )
}
