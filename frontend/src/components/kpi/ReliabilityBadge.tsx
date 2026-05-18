import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, CardTitle, StatusBadge } from '../ui'
import { formatNumber } from './format'

export function ReliabilityBadge({ kpis }: { kpis: AnalysisKpis }) {
  const r = kpis.reliability
  const tone = r.tier === 'high' ? 'success' : r.tier === 'medium' ? 'warning' : 'risk'
  const iv = kpis.intervention_confidence

  return (
    <Card padding="lg" tone={tone}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="min-w-[180px] flex-1">
          <CardEyebrow>Model reliability</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Separation &amp; stability</CardTitle>
          <div className="mt-3">
            <StatusBadge tone={tone} dot className="text-xs">
              {r.tier}
            </StatusBadge>
          </div>
        </div>
        <div className="min-w-[180px] flex-1 lg:border-l lg:border-[var(--border-soft)] lg:pl-10">
          <CardEyebrow>Intervention confidence</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Action readiness</CardTitle>
          <div className="mt-3">
            <StatusBadge
              tone={
                iv?.tier === 'high' ? 'success' : iv?.tier === 'low' ? 'risk' : iv?.tier === 'medium' ? 'warning' : 'default'
              }
              dot
              className="text-xs"
            >
              {iv?.tier ?? 'unknown'}
            </StatusBadge>
          </div>
          {iv?.rationale_bullets?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] leading-5 text-[var(--text-2)]">
              {iv.rationale_bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11px] text-[var(--text-3)]">
              A strong model can still misstate causal lift — pair scenarios with pilots.
            </p>
          )}
        </div>
        <div className="flex-1 border-t border-[var(--border-soft)] pt-6 text-sm leading-6 text-[var(--text-1)] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className="text-base font-bold tracking-tight">
            Headline{' '}
            <span className="tabular-nums">{formatNumber(r.headline_value)}</span>{' '}
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-2)]">
              ({r.headline_metric})
            </span>
            {r.cv_std !== undefined && r.cv_std !== null ? (
              <span className="ml-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-2)]">
                · CV std <span className="tabular-nums">{formatNumber(r.cv_std)}</span>
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">{r.hint}</p>
          {r.business_explanation ? (
            <p className="mt-3 text-xs leading-5 text-[var(--text-3)]">{r.business_explanation}</p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
