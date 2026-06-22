/**
 * PageSkeletons — content-shaped loading placeholders for each route.
 * Each skeleton mirrors the exact layout of its page for a seamless
 * perceived-performance boost and zero jarring spinners.
 */
import { SkeletonBlock, SkeletonGroup, SkeletonLine, SkeletonRow, SkeletonStat } from './ui/Skeleton'

/* ─── Shared page chrome ─────────────────────────────────────────────────── */

/** Reusable: eyebrow + title + description header */
function SkeletonPageHeader({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-3">
      <SkeletonLine className="h-2 w-20" />
      <SkeletonLine className={`h-8 ${wide ? 'w-72' : 'w-56'}`} />
      <SkeletonLine className="h-3 w-96 max-w-full" />
    </div>
  )
}

/** Reusable: stat card grid */
function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => <SkeletonStat key={i} />)}
    </div>
  )
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
export function DashboardSkeleton() {
  return (
    <SkeletonGroup label="Loading dashboard…">
      <div className="space-y-8 animate-fade-in-up">
        <SkeletonPageHeader wide />

        {/* KPI stat strip */}
        <SkeletonStatGrid count={4} />

        {/* Two-column content: chart + recent list */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <SkeletonBlock className="h-64 w-full" />
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>

        {/* Bottom full-width chart */}
        <SkeletonBlock className="h-48 w-full" />
      </div>
    </SkeletonGroup>
  )
}

/* ─── Datasets list ──────────────────────────────────────────────────────── */
export function DatasetsListSkeleton() {
  return (
    <SkeletonGroup label="Loading datasets…">
      <div className="space-y-8 animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <SkeletonPageHeader />
          <SkeletonBlock className="h-10 w-36 shrink-0" />
        </div>

        {/* Cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl border border-(--border-subtle) bg-(--surface-1) p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <SkeletonLine className="w-3/4" />
                  <SkeletonLine className="h-2 w-1/2" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(j => (
                  <div key={j} className="space-y-1.5 text-center">
                    <SkeletonLine className="h-5 w-full" />
                    <SkeletonLine className="h-2 w-2/3 mx-auto" />
                  </div>
                ))}
              </div>
              <SkeletonBlock className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  )
}

/* ─── Dataset detail ─────────────────────────────────────────────────────── */
export function DatasetDetailSkeleton() {
  return (
    <SkeletonGroup label="Loading dataset…">
      <div className="space-y-8 animate-fade-in-up">
        {/* Back link */}
        <SkeletonLine className="h-3 w-28" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <SkeletonPageHeader wide />
          <SkeletonBlock className="h-9 w-32 shrink-0" />
        </div>

        {/* Stat row */}
        <SkeletonStatGrid count={4} />

        {/* Config card */}
        <SkeletonBlock className="h-48 w-full" />

        {/* Two column: column cards + preview table */}
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-3">
            <SkeletonPageHeader />
            <SkeletonBlock className="h-24 w-full" />
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="rounded-lg border border-(--border-subtle) bg-(--surface-1) p-4 space-y-3">
                <div className="flex justify-between">
                  <SkeletonLine className="w-1/3" />
                  <SkeletonLine className="h-4 w-12" />
                </div>
                <SkeletonBlock className="h-1.5 w-full" />
                <div className="flex justify-between">
                  <SkeletonLine className="h-2 w-16" />
                  <SkeletonLine className="h-2 w-20" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <SkeletonPageHeader />
            <SkeletonBlock className="h-80 w-full" />
          </div>
        </div>
      </div>
    </SkeletonGroup>
  )
}

/* ─── Upload ─────────────────────────────────────────────────────────────── */
export function UploadSkeleton() {
  return (
    <SkeletonGroup label="Loading upload page…">
      <div className="space-y-8 animate-fade-in-up max-w-2xl mx-auto">
        <SkeletonPageHeader />

        {/* Drop zone */}
        <div className="rounded-2xl border-2 border-dashed border-(--border-default) bg-(--surface-1) p-16 flex flex-col items-center gap-4">
          <SkeletonBlock className="h-12 w-12 rounded-full" />
          <SkeletonLine className="h-5 w-48" />
          <SkeletonLine className="h-3 w-64" />
          <SkeletonBlock className="h-10 w-36 mt-2" />
        </div>

        {/* Recent uploads */}
        <div className="space-y-3">
          <SkeletonLine className="h-4 w-32" />
          {Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    </SkeletonGroup>
  )
}

/* ─── Analyses list ──────────────────────────────────────────────────────── */
export function AnalysesListSkeleton() {
  return (
    <SkeletonGroup label="Loading analyses…">
      <div className="space-y-6 animate-fade-in-up">
        {/* Header + search bar */}
        <div className="flex items-start justify-between gap-4">
          <SkeletonPageHeader />
        </div>
        <div className="flex gap-3">
          <SkeletonBlock className="h-10 flex-1 max-w-xs" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBlock key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="grid gap-2">
          {Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    </SkeletonGroup>
  )
}

/* ─── Analysis result ────────────────────────────────────────────────────── */
export function AnalysisResultSkeleton() {
  return (
    <SkeletonGroup label="Loading analysis results…">
      <div className="space-y-8 animate-fade-in-up pb-20">
        {/* Back */}
        <SkeletonLine className="h-3 w-28" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <SkeletonPageHeader wide />
          <div className="flex gap-2 shrink-0">
            <SkeletonBlock className="h-9 w-28" />
            <SkeletonBlock className="h-9 w-24" />
          </div>
        </div>

        {/* Sticky strip placeholder */}
        <SkeletonBlock className="h-16 w-full" />

        {/* Stat grid */}
        <SkeletonStatGrid count={4} />

        {/* Tab bar */}
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonBlock key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>

        {/* Main content: big chart + side panel */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <SkeletonBlock className="h-72 w-full" />
          <div className="space-y-4">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>
        </div>

        {/* Driver cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-(--border-subtle) bg-(--surface-1) p-5 space-y-4">
              <div className="flex justify-between items-start">
                <SkeletonLine className="w-2/5 h-4" />
                <SkeletonBlock className="h-5 w-14 rounded-full" />
              </div>
              <SkeletonBlock className="h-1.5 w-full" />
              <SkeletonLine className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  )
}

/* ─── Compare analyses ───────────────────────────────────────────────────── */
export function CompareAnalysesSkeleton() {
  return (
    <SkeletonGroup label="Loading comparison view…">
      <div className="space-y-8 animate-fade-in-up">
        <SkeletonPageHeader wide />

        {/* Two-column compare panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map(side => (
            <div key={side} className="space-y-4">
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonStatGrid count={2} />
              <SkeletonBlock className="h-56 w-full" />
            </div>
          ))}
        </div>

        {/* Delta row */}
        <SkeletonBlock className="h-24 w-full" />
      </div>
    </SkeletonGroup>
  )
}

/* ─── Auth (login / register) ────────────────────────────────────────────── */
export function AuthSkeleton() {
  return (
    <SkeletonGroup label="Loading…">
      <div className="flex min-h-[80vh] items-center justify-center animate-fade-in-up">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-(--border-subtle) bg-(--surface-1) p-8">
          <div className="space-y-2 text-center">
            <SkeletonBlock className="h-10 w-10 rounded-full mx-auto" />
            <SkeletonLine className="h-6 w-40 mx-auto" />
            <SkeletonLine className="h-3 w-56 mx-auto" />
          </div>
          <div className="space-y-4 mt-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <SkeletonLine className="h-3 w-16" />
                <SkeletonBlock className="h-10 w-full" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="h-11 w-full mt-2" />
          <SkeletonLine className="h-3 w-48 mx-auto" />
        </div>
      </div>
    </SkeletonGroup>
  )
}
