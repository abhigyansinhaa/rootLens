import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, StatusBadge } from '../ui'
import { ConfidenceArc } from './ConfidenceArc'
import { formatNumber } from './format'

export function ReliabilityBadge({ kpis }: { kpis: AnalysisKpis }) {
  const r = kpis.reliability
  const tone = r.tier === 'high' ? 'success' : r.tier === 'medium' ? 'warning' : 'risk'
  const iv = kpis.intervention_confidence

  return (
    <Card padding="lg" tone={tone} className="w-full overflow-hidden">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-4 border-b border-(--border-subtle)">
          <div>
            <CardEyebrow>Model reliability</CardEyebrow>
            <h2 className="mt-1 text-base font-bold text-(--text-1)">Separation &amp; stability</h2>
            <div className="mt-2.5 flex items-center gap-2">
              <ConfidenceArc cvRatio={r.cv_std} tier={r.tier} size={26} />
              <StatusBadge tone={tone} dot className="text-xs capitalize">
                {r.tier}
              </StatusBadge>
            </div>
          </div>
          <div className="sm:border-l sm:border-(--border-subtle) sm:pl-6">
            <CardEyebrow>Intervention confidence</CardEyebrow>
            <h2 className="mt-1 text-base font-bold text-(--text-1)">Action readiness</h2>
            <div className="mt-2.5 flex items-center gap-2">
              <ConfidenceArc tier={iv?.tier} size={26} />
              <StatusBadge
                tone={
                  iv?.tier === 'high' ? 'success' : iv?.tier === 'low' ? 'risk' : iv?.tier === 'medium' ? 'warning' : 'default'
                }
                dot
                className="text-xs capitalize"
              >
                {iv?.tier ?? 'unknown'}
              </StatusBadge>
            </div>
          </div>
        </div>

        {iv?.rationale_bullets?.length ? (
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-5 text-(--text-2)">
            {iv.rationale_bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}

        <div className="text-sm leading-6 text-(--text-1) pt-2">
          <p className="text-sm font-bold tracking-tight">
            Headline{' '}
            <span className="tabular-nums">{formatNumber(r.headline_value)}</span>{' '}
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-(--text-2)">
              ({r.headline_metric})
            </span>
            {r.cv_std !== undefined && r.cv_std !== null ? (
              <span className="ml-2 text-xs font-medium uppercase tracking-[0.16em] text-(--text-2)">
                · CV std <span className="tabular-nums">{formatNumber(r.cv_std)}</span>
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-(--text-2)">{r.hint}</p>
          {r.business_explanation ? (
            <p className="mt-2 text-xs leading-5 text-(--text-3)">{r.business_explanation}</p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
