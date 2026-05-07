import type { ReactNode } from 'react'
import { Stat } from '../ui'

type Props = {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'amber' | 'emerald' | 'brand' | 'risk'
}

const toneMap: Record<NonNullable<Props['tone']>, 'default' | 'warning' | 'success' | 'info' | 'risk'> = {
  default: 'default',
  amber: 'warning',
  emerald: 'success',
  brand: 'info',
  risk: 'risk',
}

export function KpiCard({ label, value, hint, tone = 'default' }: Props) {
  return <Stat label={label} value={value} hint={hint} tone={toneMap[tone]} />
}
