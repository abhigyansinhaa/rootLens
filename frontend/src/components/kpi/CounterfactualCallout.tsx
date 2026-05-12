import type { AnalysisKpis, AnalysisReport } from '../../types'
import { Card, CardEyebrow, StatusBadge } from '../ui'
import { formatCompactMoney, formatPct01, formatNumber } from './format'

export function CounterfactualCallout({
  kpis,
  regression,
  trustCopy,
}: {
  kpis: AnalysisKpis
  regression: boolean
  trustCopy?: AnalysisReport['trust_copy']
}) {
  const t2 = kpis.driver_impact.top2
  const apr = kpis.driver_impact.approximation

  const subtitle =
    apr === 'shap_zeroing'
      ? 'SHAP drivers are associative. Zero-out is a scenario estimate, not a guaranteed lift.'
      : 'Uses importance shares when dense SHAP was unavailable.'

  const deltaAbs = Math.abs(t2.delta_target_rate)
  const rev = t2.revenue_recoverable

  const mainLine = regression ? (
    <>
      Neutralizing the top <span className="font-bold">2</span> drivers shifts the predicted outcome by{' '}
      <span className="tabular-nums">{formatPct01(deltaAbs)}</span> of scale.
    </>
  ) : (
    <>
      Neutralizing the top <span className="font-bold">2</span> drivers shifts the predicted positive rate by{' '}
      <span className="tabular-nums">{formatPct01(deltaAbs)}</span> points.
    </>
  )

  const revLine =
    rev != null && Number.isFinite(rev) && Math.abs(rev) > 1e-9 ? (
      <span>
        Revenue lift signal:{' '}
        <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
          {formatCompactMoney(rev)}
        </span>
        {' · '}users crossing high to low thresholds:{' '}
        <span className="font-bold tabular-nums text-[var(--text-1)]">
          {formatNumber(t2.users_savable, 0)}
        </span>
        .
      </span>
    ) : (
      <span>Add a numeric value column on the next analysis to quantify revenue-linked lift.</span>
    )

  const causal = trustCopy?.counterfactual_causal_disclaimer
  const corr = trustCopy?.correlation_not_causation
  const roiNote = trustCopy?.roi_assumptions

  return (
    <Card padding="lg" tone="info" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardEyebrow>What-if scenario</CardEyebrow>
        <StatusBadge tone="info" dot>
          Counterfactual estimate
        </StatusBadge>
        {t2.confidence_tier ? (
          <StatusBadge tone="default">Scenario tier: {t2.confidence_tier}</StatusBadge>
        ) : null}
      </div>
      <p className="text-xl font-bold leading-tight text-[var(--text-1)]">{mainLine}</p>
      <p className="text-sm leading-6 text-[var(--text-2)]">{revLine}</p>
      <p className="rounded-lg border border-amber-700/30 bg-amber-950/10 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
        {causal ??
          'Scenario estimates are based on modeled associations. They are not guaranteed causal outcomes.'}{' '}
        {corr ? <span className="mt-1 block font-normal opacity-90">{corr}</span> : null}
      </p>
      {roiNote ? (
        <p className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-3)]/60 px-3 py-2 text-[11px] leading-5 text-[var(--text-3)]">
          {roiNote}
        </p>
      ) : null}
      <p className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-3)]/60 px-3 py-2 text-[11px] leading-5 text-[var(--text-3)]">
        {subtitle}
      </p>
    </Card>
  )
}
