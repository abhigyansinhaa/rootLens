/**
 * SkeletonCard — animated shimmer placeholder for loading states.
 * Use instead of spinners for content-shaped loading feedback.
 */
import type { ReactNode } from 'react'

interface SkeletonProps {
  className?: string
}

/** A single shimmer line */
export function SkeletonLine({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 rounded-full bg-[var(--surface-3)] animate-pulse ${className}`}
    />
  )
}

/** A shimmer block (for cards/images) */
export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[var(--radius-md)] bg-[var(--surface-3)] animate-pulse ${className}`}
    />
  )
}

/** A full analysis-list row skeleton */
export function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
    >
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--surface-3)] animate-pulse" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-2/5" />
        <SkeletonLine className="w-1/4 h-2" />
      </div>
      <SkeletonLine className="w-12 h-2 shrink-0" />
      <div className="h-4 w-4 rounded bg-[var(--surface-3)] animate-pulse shrink-0" />
    </div>
  )
}

/** A KPI stat card skeleton */
export function SkeletonStat() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 space-y-3"
    >
      <SkeletonLine className="w-1/3 h-2" />
      <SkeletonLine className="w-2/3 h-6" />
      <SkeletonLine className="w-1/2 h-2" />
    </div>
  )
}

/** Wraps children with a screen-reader only loading announcement */
export function SkeletonGroup({ children, label = 'Loading…' }: { children: ReactNode; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  )
}
