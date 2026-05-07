import type { AnalysisKpis } from '../../types'
import { Card, CardEyebrow, CardTitle, StatusBadge } from '../ui'
import { formatNumber } from './format'

export function ReliabilityBadge({ kpis }: { kpis: AnalysisKpis }) {
  const r = kpis.reliability
  const tone = r.tier === 'high' ? 'success' : r.tier === 'medium' ? 'warning' : 'risk'

  return (
    <Card padding="lg" tone={tone}>
      <div className="flex flex-wrap items-start gap-5 sm:flex-nowrap sm:items-center">
        <div className="min-w-[180px]">
          <CardEyebrow>Model reliability</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Confidence tier</CardTitle>
          <div className="mt-3">
            <StatusBadge tone={tone} dot className="text-xs">
              {r.tier}
            </StatusBadge>
          </div>
        </div>
        <div className="flex-1 text-sm leading-6 text-[var(--text-1)]">
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
        </div>
      </div>
    </Card>
  )
}
