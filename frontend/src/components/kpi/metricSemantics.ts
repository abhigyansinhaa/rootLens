export type MetricTone = 'default' | 'amber' | 'emerald' | 'brand' | 'risk'

/** Threshold semantics aligned with `report.ui_thresholds` defaults. */
export function predictedChurnTone(rate: number | undefined): MetricTone {
  if (rate == null || Number.isNaN(rate)) return 'default'
  if (rate < 0.1) return 'emerald'
  if (rate <= 0.2) return 'amber'
  return 'risk'
}

export function historicChurnTone(rate: number | undefined): MetricTone {
  return predictedChurnTone(rate)
}

export function rocAucTone(auc: number | undefined): MetricTone {
  if (auc == null || Number.isNaN(auc)) return 'default'
  if (auc >= 0.8) return 'emerald'
  if (auc >= 0.7) return 'amber'
  return 'risk'
}

export function concentrationShareTone(share: number | undefined): MetricTone {
  if (share == null || Number.isNaN(share)) return 'default'
  if (share < 0.5) return 'emerald'
  if (share <= 0.7) return 'amber'
  return 'risk'
}

export function highRiskShareTone(share: number | undefined): MetricTone {
  if (share == null || Number.isNaN(share)) return 'default'
  if (share < 0.15) return 'emerald'
  if (share <= 0.3) return 'amber'
  return 'risk'
}
