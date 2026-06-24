import { useMemo, useState } from 'react'
import type { AnalysisKpis } from '../../types'
import { formatDriverLabel } from '../../lib/driverLabels'
import { formatPct01 } from '../../components/kpi/format'
import { Sliders, RefreshCw, TrendingDown, Info } from 'lucide-react'

interface WhatIfSimulatorProps {
  kpis: AnalysisKpis
  rawColumns?: string[]
}

interface DriverScenario {
  feature: string
  label: string
  currentShare: number   // 0–1
  scenarioReduction: number // 0–1, user-controlled
  revenueRecoverable: number | null
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function pctLabel(v: number) {
  return `${Math.round(v * 100)}%`
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

/* ─── Slider component ─────────────────────────────────────────────────── */
function DriverSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  color: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-(--text-2) truncate pr-2" title={label}>
          {label}
        </span>
        <span
          className="text-xs font-bold tabular-nums shrink-0"
          style={{ color }}
        >
          {pctLabel(value)} reduction
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${Math.round(value * 100)}%, var(--surface-4) ${Math.round(value * 100)}%, var(--surface-4) 100%)`,
          }}
          aria-label={`Reduction scenario for ${label}`}
        />
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────────────────── */
export function WhatIfSimulator({ kpis, rawColumns }: WhatIfSimulatorProps) {
  const top3 = useMemo((): DriverScenario[] => {
    const perDriver = kpis.driver_impact?.per_driver ?? []
    return perDriver.slice(0, 3).map((d) => ({
      feature: d.feature,
      label: formatDriverLabel(d.feature, rawColumns),
      currentShare: kpis.drivers.find(dr => dr.feature === d.feature)?.share ?? 0,
      scenarioReduction: 0.5, // default 50%
      revenueRecoverable: d.revenue_recoverable ?? null,
    }))
  }, [kpis, rawColumns])

  const [reductions, setReductions] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    top3.forEach((d) => { init[d.feature] = 0.5 })
    return init
  })

  const setReduction = (feature: string, v: number) => {
    setReductions((prev) => ({ ...prev, [feature]: v }))
  }

  const reset = () => {
    const init: Record<string, number> = {}
    top3.forEach((d) => { init[d.feature] = 0.5 })
    setReductions(init)
  }

  const baseHighRiskShare = kpis.target_level.high_risk_share
  const baseRevAtRisk = kpis.impact_revenue?.revenue_at_risk ?? null

  // Projected lift: weighted sum of (driver importance share × reduction %)
  const projectedLift = useMemo(() => {
    return top3.reduce((acc, d) => {
      return acc + d.currentShare * (reductions[d.feature] ?? 0)
    }, 0)
  }, [top3, reductions])

  const projectedHighRisk = Math.max(0, baseHighRiskShare - projectedLift * baseHighRiskShare)
  const projectedRevRecov = baseRevAtRisk != null
    ? top3.reduce((acc, d) => {
      const r = d.revenueRecoverable
      if (r == null) return acc
      return acc + Math.abs(r) * (reductions[d.feature] ?? 0)
    }, 0)
    : null

  const COLORS = [
    'hsl(214 100% 59%)',
    'hsl(158 64% 46%)',
    'hsl(38 92% 55%)',
  ]

  if (!top3.length) return null

  return (
    <div className="rounded-xl border border-(--border-default) bg-(--surface-1) overflow-hidden">
      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-(--border-subtle) bg-(--surface-2) px-6 py-4">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-32 w-48 opacity-20"
          style={{ background: 'radial-gradient(ellipse at right top, hsl(214 100% 59%), transparent 70%)' }}
        />
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-(--brand-dim) border border-(--border-brand)">
            <Sliders className="h-4 w-4 text-(--brand)" />
          </div>
          <div>
            <p className="text-[10px] font-bold upperootLensse tracking-[0.16em] text-(--brand)">
              What-If Simulator
            </p>
            <h2 className="text-base font-bold text-(--text-1)">
              Model impact of driver interventions
            </h2>
          </div>
        </div>
        <button
          onClick={reset}
          className="relative z-10 flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--surface-1) px-3 py-1.5 text-xs font-semibold text-(--text-2) hover:bg-(--surface-3) hover:text-(--text-1) transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_1px_300px]">
        {/* Left — sliders */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-(--text-2)">
            Adjust the slider for each driver to simulate what would happen if you reduced its
            impact on the target by that percentage. Results are <em>approximations</em> based on
            SHAP attribution — not causal predictions.
          </p>
          <div className="space-y-5">
            {top3.map((d, i) => (
              <DriverSlider
                key={d.feature}
                label={d.label}
                value={reductions[d.feature] ?? 0.5}
                onChange={(v) => setReduction(d.feature, v)}
                color={COLORS[i]}
              />
            ))}
          </div>
          <div className="flex items-start gap-2 rounded-md border border-(--border-subtle) bg-(--brand-dimmer) p-3">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-(--brand)" aria-hidden />
            <p className="text-[11px] text-(--text-3) leading-relaxed">
              Associative, not causal. Reducing a SHAP driver assumes the feature can be targeted in
              isolation. Real interventions involve dependencies and lag effects.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block bg-(--border-subtle)" aria-hidden />

        {/* Right — projected outcomes */}
        <div className="p-6 space-y-5 bg-(--surface-2)/50 border-t border-(--border-subtle) lg:border-t-0">
          <p className="text-[10px] font-bold upperootLensse tracking-[0.16em] text-(--text-3)">
            Projected outcome
          </p>

          {/* High-risk share */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-(--text-3)">
              <span>High-risk share</span>
              <span className="font-mono font-bold text-(--text-2)">
                {formatPct01(baseHighRiskShare)} → {' '}
                <span className="text-(--c-success)">{formatPct01(projectedHighRisk)}</span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-(--surface-4) overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-(--c-danger) transition-all duration-500"
                style={{ width: `${projectedHighRisk * 100}%` }}
              />
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-(--border-subtle) opacity-50 transition-all duration-500"
                style={{ width: `${baseHighRiskShare * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-(--c-success) font-semibold flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              {formatPct01(Math.max(0, baseHighRiskShare - projectedHighRisk))} reduction
            </p>
          </div>

          {/* Revenue recovery */}
          {projectedRevRecov != null && (
            <div className="rounded-lg border border-(--c-success-border) bg-(--c-success-bg) p-4">
              <p className="text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--c-success) mb-1">
                Potential revenue recovery
              </p>
              <p className="text-2xl font-bold tabular-nums text-(--c-success)">
                {fmt(projectedRevRecov)}
              </p>
              <p className="text-[11px] text-(--text-3) mt-1">
                Based on weighted SHAP attribution
              </p>
            </div>
          )}

          {/* Combined lift */}
          <div className="rounded-lg border border-(--border-default) bg-(--surface-1) p-4">
            <p className="text-[10px] font-bold upperootLensse tracking-[0.14em] text-(--text-3) mb-1">
              Combined lift
            </p>
            <p className="text-2xl font-bold tabular-nums text-(--brand)">
              {formatPct01(projectedLift * baseHighRiskShare)}
            </p>
            <p className="text-[11px] text-(--text-3) mt-1">
              Estimated reduction in high-risk exposure
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
