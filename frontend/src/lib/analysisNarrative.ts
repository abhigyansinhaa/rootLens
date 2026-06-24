import type { Analysis, AnalysisKpis } from '../types'
import { formatDriverLabel } from './driverLabels'
import { formatCompactMoney, formatPct01 } from './kpiFormat'

export type NarrativeCitation = {
  id: number
  label: string
  sectionId: string
  confidence: 'high' | 'medium' | 'low'
}

export type AnalysisNarrative = {
  executive_brief: string
  concentration_insight: string
  driver_insight: string | null
  action_insight: string | null
  citations: NarrativeCitation[]
  suggested_actions: { label: string; action: string }[]
}

export function buildAnalysisNarrative(
  analysis: Analysis,
  kpis: AnalysisKpis,
  rawColumns?: string[],
): AnalysisNarrative {
  const h = kpis.concentration.headline
  const topPct = (h.top_pct_users * 100).toFixed(0)
  const shareRisk = formatPct01(h.share_of_risk)
  const rate = kpis.target_level.predicted_target_rate ?? kpis.target_level.target_rate
  const revenue = kpis.impact_revenue?.revenue_at_risk
  const topDriver = kpis.drivers[0]
  const topDriverName = topDriver
    ? formatDriverLabel(topDriver.feature, rawColumns)
    : null
  const topDriverStats = topDriver
    ? kpis.driver_impact?.per_driver?.find((d) => d.feature === topDriver.feature)
    : null
  const relTier = kpis.reliability.tier

  const citations: NarrativeCitation[] = [
    {
      id: 1,
      label: 'Concentration · Pareto',
      sectionId: 'concentration-section',
      confidence: kpis.concentration.gini > 0.5 ? 'high' : 'medium',
    },
  ]

  if (topDriver) {
    citations.push({
      id: 2,
      label: `${topDriverName} · SHAP`,
      sectionId: 'drivers-section',
      confidence: (topDriverStats?.confidence_tier as 'high' | 'medium' | 'low') ?? 'medium',
    })
  }

  citations.push({
    id: 3,
    label: `Reliability · ${kpis.reliability.headline_metric}`,
    sectionId: 'trust-section',
    confidence: relTier,
  })

  const rateStr = rate != null ? formatPct01(rate) : 'an elevated rate'
  const executive_brief = revenue != null
    ? `Predicted ${analysis.target} rate is ${rateStr}, with ${formatCompactMoney(revenue)} in modeled exposure. The top ${topPct}% of the population holds ${shareRisk} of total risk.`
    : `Predicted ${analysis.target} rate is ${rateStr}. The top ${topPct}% of the population holds ${shareRisk} of total modeled exposure.`

  const concentration_insight = `Risk is highly concentrated — just ${topPct}% of users account for ${shareRisk} of expected exposure. Prioritize interventions on this high-risk tail for maximum ROI.`

  let driver_insight: string | null = null
  let action_insight: string | null = null

  if (topDriver && topDriverName && topDriverStats) {
    const recover =
      topDriverStats.revenue_recoverable != null
        ? formatCompactMoney(Math.abs(topDriverStats.revenue_recoverable))
        : formatPct01(Math.abs(topDriverStats.delta_target_rate))
    driver_insight = `${topDriverName} is the primary root cause, explaining ${formatPct01(topDriver.share, 0)} of feature importance.`
    action_insight = `Neutralizing ${topDriverName} could recover up to ${recover} in exposure under current model assumptions.`
  }

  return {
    executive_brief,
    concentration_insight,
    driver_insight,
    action_insight,
    citations,
    suggested_actions: [
      { label: 'Export high-risk segment', action: 'export-segment' },
      { label: 'Run counterfactual', action: 'what-if' },
      { label: 'Download decision brief', action: 'decision-brief' },
    ],
  }
}
