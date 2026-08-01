import { useMemo, useState, useRef, useCallback } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalysisKpis, Analysis } from '../../../types'
import { DriverImpactCard, ReliabilityBadge, RiskSegmentsChart } from '../../../components/kpi'
import { ChartTooltip, chartTooltipStyle } from '../../../components/ui'
import { formatDriverLabel } from '../../../lib/driverLabels'
import { chartPalette } from '../../../lib/chartPalette'

interface DriversTabProps {
  data: Analysis
  kpis: AnalysisKpis
  directionByFeature: Record<string, string>
  rawColumnNames: string[]
  revenueReady: boolean
  highlightedDriver?: string | null
  onDriverHover?: (feature: string | null) => void
  onHighlightChange?: (feature: string | null) => void
  driverSearchRef?: React.RefObject<HTMLInputElement | null>
}

interface ChartRow {
  name: string
  full: string
  importance: number
  feature: string
}

function ShapTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <ChartTooltip
      active
      title={d.full}
      value={d.importance.toFixed(4)}
      context="Mean |SHAP|"
    />
  )
}

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
    <div className="h-96 w-full" role="img" aria-label="Feature importance by mean absolute SHAP">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
          onClick={(state) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s = state as any
            if (s?.activePayload?.[0]) {
              const clicked = (s.activePayload[0].payload as ChartRow).feature
              onSelectFeature(selectedFeature === clicked ? null : clicked)
            }
          }}
        >
          <XAxis
            type="number"
            tick={{ fill: 'var(--text-3)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={148}
            tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ShapTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={chartTooltipStyle} />
          <Bar dataKey="importance" radius={[0, 6, 6, 0]} cursor="pointer">
            {chartData.map((entry) => {
              const isSelected = selectedFeature === null || selectedFeature === entry.feature
              return (
                <Cell
                  key={entry.feature}
                  fill={chartPalette[1]}
                  fillOpacity={isSelected ? 1 : 0.25}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DriversTab({
  data,
  kpis,
  directionByFeature,
  rawColumnNames,
  revenueReady,
  highlightedDriver,
  onDriverHover,
  onHighlightChange,
  driverSearchRef,
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

  const handleSelectFeature = useCallback(
    (feature: string | null) => {
      setSelectedFeature(feature)
      onHighlightChange?.(feature)
      if (feature && driverCardRef.current) {
        setTimeout(() => driverCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      }
    },
    [onHighlightChange],
  )

  const activeHighlight = selectedFeature || highlightedDriver

  return (
    <div className="space-y-12 print:block">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
        <RiskSegmentsChart kpis={kpis} hasValue={revenueReady} />
        <ReliabilityBadge kpis={kpis} />
      </div>

      {chartData.length > 0 && (
        <div id="drivers-section" className="scroll-mt-28">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-(--text-1)">Feature importance</h3>
              <p className="text-sm text-(--text-3) mt-0.5">Mean |SHAP| — click a bar to highlight the driver row</p>
            </div>
            {selectedFeature && (
              <button
                onClick={() => handleSelectFeature(null)}
                className="text-xs font-medium text-(--brand) hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="rounded-lg bg-(--surface-1) p-4 border border-(--border-subtle)">
            <InteractiveShapChart
              chartData={chartData}
              selectedFeature={selectedFeature}
              onSelectFeature={handleSelectFeature}
            />
          </div>
        </div>
      )}

      <div ref={driverCardRef}>
        <DriverImpactCard
          kpis={kpis}
          directionByFeature={directionByFeature}
          roiAssumptions={data.report?.trust_copy?.roi_assumptions}
          rawColumns={rawColumnNames}
          shapSummaryUrl={data.shap_summary_image_url}
          shapBeeswarmUrl={data.shap_beeswarm_image_url}
          highlightFeature={activeHighlight}
          onHighlightChange={(f) => {
            onHighlightChange?.(f)
            onDriverHover?.(f)
          }}
          searchInputRef={driverSearchRef}
        />
      </div>
    </div>
  )
}
