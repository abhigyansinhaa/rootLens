import type { ReactNode } from 'react'
import { Stat } from '../ui'

type Props = {
  label: string
  value: ReactNode
  hint?: ReactNode
  ciHint?: ReactNode
  tone?: 'default' | 'amber' | 'emerald' | 'brand' | 'risk'
}

const toneMap: Record<NonNullable<Props['tone']>, 'default' | 'warning' | 'success' | 'info' | 'risk'> = {
  default: 'default',
  amber: 'warning',
  emerald: 'success',
  brand: 'info',
  risk: 'risk',
}

export function KpiCard({ label, value, hint, ciHint, tone = 'default' }: Props) {
  const hintNode =
    hint || ciHint ? (
      <>
        {hint ? <span className="text-[var(--text-2)]">{hint}</span> : null}
        {ciHint ? (
          <span className="block text-[11px] font-semibold tabular-nums text-[var(--text-3)]">{ciHint}</span>
        ) : null}
      </>
    ) : undefined

  return <Stat label={label} value={value} hint={hintNode} tone={toneMap[tone]} />
}
