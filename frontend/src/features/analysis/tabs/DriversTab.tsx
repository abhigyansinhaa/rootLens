import { useMemo, useState, useRef, useCallback } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis, Analysis } from '../../../types'
import {
  DriverImpactCard,
  ReliabilityBadge,
  RiskSegmentsChart,
} from '../../../components/kpi'
import { Card, SectionHeader } from '../../../components/ui'
import { formatDriverLabel } from '../../../lib/driverLabels'

interface DriversTabProps {
  data: Analysis
  kpis: AnalysisKpis
  directionByFeature: Record<string, string>
  rawColumnNames: string[]
  revenueReady: boolean
}

interface ChartRow {
  name: string
  full: string
  importance: number
  feature: string
}

/* ─── Custom Tooltip ────────────────────────────────────────────────────── */
function ShapTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] px-4 py-3 shadow-[var(--shadow-lg)] text-sm">
      <p className="font-bold text-[var(--text-1)] mb-1">{d.full}</p>
      <p className="text-[var(--text-3)] text-xs">
        Mean |SHAP|: <span className="font-mono font-bold text-[var(--brand)]">{d.importance.toFixed(4)}</span>
      </p>
    </div>
  )
}

/* ─── Interactive SHAP Bar Chart ────────────────────────────────────────── */
function InteractiveShapChart({
  chartData,
  selectedFeature,
  onSelectFeature,
}: {
  chartData: ChartRow[]
  selectedFeature: string | null
  onSelectFeature: (feature: string | null) => void
}) {
  return (
    <div className="h-96 w-full" role="img" aria-label="Feature importance bar chart showing mean absolute SHAP values">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
          onClick={(state) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = state as any
            if (s?.activePayload?.[0]) {
              const clicked = (s.activePayload[0].payload as ChartRow).feature
              onSelectFeature(selectedFeature === clicked ? null : clicked)
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            className="opacity-40"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-3)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={148}
            tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            cursor="pointer"
          />
          <Tooltip content={<ShapTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <defs>
            <linearGradient id="shapGradientActive" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(214 100% 59%)" />
              <stop offset="100%" stopColor="hsl(258 80% 68%)" />
            </linearGradient>
            <linearGradient id="shapGradientDim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(214 100% 59% / 0.35)" />
              <stop offset="100%" stopColor="hsl(258 80% 68% / 0.25)" />
            </linearGradient>
          </defs>
          <Bar dataKey="importance" radius={[0, 6, 6, 0]} cursor="pointer">
            {chartData.map((entry) => {
              const isSelected = selectedFeature === null || selectedFeature === entry.feature
              return (
                <Cell
                  key={entry.feature}
                  fill={isSelected ? 'url(#shapGradientActive)' : 'url(#shapGradientDim)'}
                  style={{ transition: 'fill 0.2s ease' }}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Screen-reader accessible summary table (visually hidden) */}
      <div className="sr-only">
        <table>
          <caption>Feature importance rankings by mean absolute SHAP value</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Feature</th>
              <th scope="col">Mean |SHAP|</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr key={row.feature}>
                <td>{i + 1}</td>
                <td>{row.full}</td>
                <td>{row.importance.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Drivers Tab ───────────────────────────────────────────────────────── */
export function DriversTab({
  data,
  kpis,
  directionByFeature,
  rawColumnNames,
  revenueReady,
}: DriversTabProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const driverCardRef = useRef<HTMLDivElement>(null)

  const chartData: ChartRow[] = useMemo(() => {
    const fi = data.feature_importance
    if (!fi?.length) return []
    return [...fi]
      .sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)
      .slice(0, 15)
      .map((r) => {
        const label = formatDriverLabel(r.feature, rawColumnNames)
        return {
          name: label.length > 30 ? `${label.slice(0, 28)}…` : label,
          full: label,
          importance: r.mean_abs_shap,
          feature: r.feature,
        }
      })
  }, [data.feature_importance, rawColumnNames])

  const handleSelectFeature = useCallback((feature: string | null) => {
    setSelectedFeature(feature)
    if (feature && driverCardRef.current) {
      setTimeout(() => {
        driverCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }, [])

  return (
    <div className="space-y-8 print:block animate-fade-in-up">
      <SectionHeader
        eyebrow="2. Why it is happening"
        title="Drivers, Segments, and Reliability"
        description="Feature lift, segment concentration, and reliability signals for where to intervene first."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <RiskSegmentsChart kpis={kpis} hasValue={revenueReady} />
        <ReliabilityBadge kpis={kpis} />
      </div>

      {/* Interactive SHAP chart */}
      {chartData.length > 0 && (
        <div className="pt-2">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <SectionHeader
              eyebrow="Drivers"
              title="Feature Importance"
              description="Mean absolute SHAP values rank the strongest explanatory drivers. Click a bar to highlight the corresponding driver card."
            />
            {selectedFeature && (
              <button
                onClick={() => setSelectedFeature(null)}
                className="text-xs font-semibold text-[var(--brand)] hover:underline shrink-0 pb-1"
              >
                Clear selection ×
              </button>
            )}
          </div>
          <Card
            padding="lg"
            tone="strong"
            elevated
            className="border border-[var(--border-subtle)] bg-[var(--surface-1)]/50 backdrop-blur"
          >
            <InteractiveShapChart
              chartData={chartData}
              selectedFeature={selectedFeature}
              onSelectFeature={handleSelectFeature}
            />
          </Card>

          {selectedFeature && (
            <p className="mt-3 text-xs text-[var(--text-3)] text-center animate-fade-in">
              Showing driver card for{' '}
              <span className="font-semibold text-[var(--brand)]">
                {formatDriverLabel(selectedFeature, rawColumnNames)}
              </span>{' '}
              — scroll down to see it highlighted
            </p>
          )}
        </div>
      )}

      {/* Driver impact cards — scroll target */}
      <div ref={driverCardRef}>
        <DriverImpactCard
          kpis={kpis}
          directionByFeature={directionByFeature}
          roiAssumptions={data.report?.trust_copy?.roi_assumptions}
          rawColumns={rawColumnNames}
          shapSummaryUrl={data.shap_summary_image_url}
          shapBeeswarmUrl={data.shap_beeswarm_image_url}
          highlightFeature={selectedFeature}
        />
      </div>
    </div>
  )
}
