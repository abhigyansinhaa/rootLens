import { CheckCircle2, AlertTriangle, AlertCircle, type LucideIcon } from 'lucide-react'

export interface SemanticResult {
  label: string
  color: string // CSS Variable Reference
  badgeTone: 'success' | 'warning' | 'risk' | 'info'
  icon: LucideIcon
}

// Global Semantic Values
export const SEMANTICS = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
  info: 'var(--info)',
}

// Global Confidence Values
export const CONFIDENCE = {
  high: 'var(--confidence-high)',
  medium: 'var(--confidence-medium)',
  low: 'var(--confidence-low)',
}

// Global Governance Values
export const GOVERNANCE = {
  verified: 'var(--gov-verified)',
  pending: 'var(--gov-pending)',
  unverified: 'var(--gov-unverified)',
}

// --- Specific KPI Evaluators ---

export function evaluateRocAuc(value: number): SemanticResult {
  if (value >= 0.90) {
    return { label: 'Excellent', color: SEMANTICS.success, badgeTone: 'success', icon: CheckCircle2 }
  }
  if (value >= 0.80) {
    return { label: 'Good', color: SEMANTICS.success, badgeTone: 'success', icon: CheckCircle2 }
  }
  if (value >= 0.70) {
    return { label: 'Review', color: SEMANTICS.warning, badgeTone: 'warning', icon: AlertTriangle }
  }
  return { label: 'Weak', color: SEMANTICS.critical, badgeTone: 'risk', icon: AlertCircle }
}

export function evaluateCalibration(state: 'excellent' | 'acceptable' | 'review' | 'poor'): SemanticResult {
  switch (state) {
    case 'excellent':
      return { label: 'Excellent', color: SEMANTICS.success, badgeTone: 'success', icon: CheckCircle2 }
    case 'acceptable':
      return { label: 'Acceptable', color: SEMANTICS.success, badgeTone: 'success', icon: CheckCircle2 }
    case 'review':
      return { label: 'Review', color: SEMANTICS.warning, badgeTone: 'warning', icon: AlertTriangle }
    case 'poor':
      return { label: 'Poor', color: SEMANTICS.critical, badgeTone: 'risk', icon: AlertCircle }
  }
}

export function evaluateDatasetHealth(state: 'healthy' | 'moderate' | 'poor'): SemanticResult {
  switch (state) {
    case 'healthy':
      return { label: 'Healthy', color: SEMANTICS.success, badgeTone: 'success', icon: CheckCircle2 }
    case 'moderate':
      return { label: 'Moderate', color: SEMANTICS.warning, badgeTone: 'warning', icon: AlertTriangle }
    case 'poor':
      return { label: 'Poor', color: SEMANTICS.critical, badgeTone: 'risk', icon: AlertCircle }
  }
}

export function evaluateRevenueRisk(state: 'low' | 'medium' | 'high'): SemanticResult {
  switch (state) {
    case 'low':
      return { label: 'Low', color: SEMANTICS.success, badgeTone: 'success', icon: CheckCircle2 }
    case 'medium':
      return { label: 'Medium', color: SEMANTICS.warning, badgeTone: 'warning', icon: AlertTriangle }
    case 'high':
      return { label: 'High', color: SEMANTICS.critical, badgeTone: 'risk', icon: AlertCircle }
  }
}
