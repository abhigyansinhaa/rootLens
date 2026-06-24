import { useMemo } from 'react'
import type { Analysis, AnalysisKpis } from '../../types'
import { Card } from '../ui'
import { formatCompactMoney, formatNumber, formatPct01 } from './format'

export function ExecutiveSummaryHero({
  detail,
  kpis,
}: {
  detail: Analysis
  kpis: AnalysisKpis
}) {
  const isRegression = detail.task_type === 'regression'

  const baseline = useMemo(() => {
    if (isRegression) {
      return kpis.target_level.target_mean !== undefined
        ? formatNumber(kpis.target_level.target_mean, 4)
        : 'unknown'
    }
    return kpis.target_level.target_rate !== undefined
      ? formatPct01(kpis.target_level.target_rate)
      : 'unknown'
  }, [isRegression, kpis])

  const highRiskShare = formatPct01(kpis.target_level.high_risk_share)
  const highRiskCount = kpis.target_level.high_risk_count.toLocaleString()
  const revenue = kpis.impact_revenue
    ? formatCompactMoney(kpis.impact_revenue.revenue_at_risk)
    : null

  const relTier = kpis.reliability.tier
  const relMetric = kpis.reliability.headline_metric
  const relValue = formatNumber(kpis.reliability.headline_value)

  return (
    <Card padding="xl" tone="strong" elevated className="relative overflow-hidden border-2 border-(--border-subtle) bg-linear-to-br from-(--surface-1) to-(--surface-2)">
      {/* Decorative background element */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/5 blur-[80px] pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />

      <div className="relative z-10">
        <p className="text-[10px] font-black upperootLensse tracking-[0.2em] text-brand-600 dark:text-brand-400 mb-4">
          Executive Summary
        </p>

        <h2 className="text-2xl sm:text-3xl font-medium leading-snug text-(--text-1) tracking-tight">
          The baseline {isRegression ? 'average' : 'rate'} for <span className="font-bold text-brand-600 dark:text-brand-400">{detail.target}</span> is <span className="font-bold">{baseline}</span>.
          Currently, <span className="font-bold text-red-600 dark:text-red-400">{highRiskShare}</span> of the population ({highRiskCount} rows) is classified as high-risk
          {revenue ? <>, putting <span className="font-bold text-emerald-600 dark:text-emerald-400">{revenue}</span> at risk</> : ''}.
          The underlying model's reliability is <span className="font-bold capitalize">{relTier}</span> ({relMetric}: {relValue}), indicating strong confidence in the root-cause drivers below.
        </h2>
      </div>
    </Card>
  )
}
