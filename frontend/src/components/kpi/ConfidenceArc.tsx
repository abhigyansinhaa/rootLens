import type { SVGProps } from 'react'

type ConfidenceTier = 'high' | 'medium' | 'low' | null | undefined

type ConfidenceArcProps = {
  cvRatio?: number | null
  tier?: ConfidenceTier
  size?: number
  className?: string
} & SVGProps<SVGSVGElement>

const colorMap: Record<'high' | 'medium' | 'low', string> = {
  high: 'var(--confidence-high)',
  medium: 'var(--confidence-medium)',
  low: 'var(--confidence-low)',
}

/**
 * Direction B signature element: A semicircular gauge arc.
 * Fill percentage = 1 - cvRatio (low cvRatio/high stability = full arc).
 */
export function ConfidenceArc({
  cvRatio,
  tier,
  size = 28,
  className = '',
  ...rest
}: ConfidenceArcProps) {
  // Normalize fill ratio: 1.0 (0% cv_ratio = 100% stable) down to 0.05 min
  const rawRatio = cvRatio !== undefined && cvRatio !== null ? Math.max(0, Math.min(1, cvRatio)) : null
  const fillRatio = rawRatio !== null ? Math.max(0.08, 1 - rawRatio) : 0.2

  const strokeColor = tier && colorMap[tier] ? colorMap[tier] : 'var(--text-3)'

  // Arc path math (semicircle from 180 deg to 0 deg, top half)
  const strokeWidth = Math.max(2.5, size * 0.12)
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2 + radius * 0.4 // Offset down slightly for visual balance

  // Semi-circle arc length = PI * radius
  const arcLength = Math.PI * radius
  const strokeDashoffset = arcLength * (1 - fillRatio)

  const ariaLabel = tier
    ? `Confidence: ${tier}${rawRatio !== null ? `, stability ${Math.round(fillRatio * 100)}%` : ''}`
    : 'Confidence: unknown'

  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox={`0 0 ${size} ${size * 0.7}`}
      fill="none"
      role="img"
      aria-label={ariaLabel}
      className={`inline-block shrink-0 align-middle ${className}`}
      {...rest}
    >
      {/* Background track arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        stroke="var(--surface-3)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={rawRatio === null ? '2 3' : undefined}
      />
      {/* Foreground fill arc */}
      {rawRatio !== null && (
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-(--duration-normal)"
        />
      )}
    </svg>
  )
}
