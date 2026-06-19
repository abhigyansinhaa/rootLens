import type { Analysis, AnalysisKpis } from '../../../types'
import {
  ConcentrationCallout,
  CounterfactualCallout,
  ExecutiveSummaryHero,
} from '../../../components/kpi'
import { SectionHeader, StatusBadge } from '../../../components/ui'
import { formatDriverLabel } from '../../../lib/driverLabels'
import { WhatIfSimulator } from '../WhatIfSimulator'

interface ImpactTabProps {
  data: Analysis
  kpis: AnalysisKpis
  rawColumnNames: string[]
}

export function ImpactTab({ data, kpis, rawColumnNames }: ImpactTabProps) {
  return (
    <div className="space-y-8 print:block animate-fade-in-up">
      <SectionHeader
        eyebrow="1. Business Impact"
        title="Executive Summary"
        description="Target behavior, high-risk exposure, and monetized impact."
      />

      <ExecutiveSummaryHero detail={data} kpis={kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConcentrationCallout kpis={kpis} />
        <CounterfactualCallout
          kpis={kpis}
          regression={data.task_type === 'regression'}
          trustCopy={data.report?.trust_copy}
        />
      </div>

      {/* What-If Simulator */}
      <WhatIfSimulator kpis={kpis} rawColumns={rawColumnNames} />

      {/* Narrative insights */}
      {data.insights && data.insights.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-[var(--border-subtle)]">
          <SectionHeader eyebrow="Narrative" title="Why is this happening?" />
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.insights.map((ins, i) => {
              const sevTone = ins.severity === 'critical' ? 'risk' : 'warning'
              const borderColor =
                ins.severity === 'critical'
                  ? 'var(--c-danger)'
                  : ins.severity === 'warning'
                  ? 'var(--c-warning)'
                  : 'var(--brand)'
              return (
                <li key={i} className={`animate-spring-up delay-${Math.min((i + 1) * 100, 400)}`}>
                  <div className="relative h-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5">
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: borderColor }}
                    />
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <StatusBadge tone="info">{ins.kind}</StatusBadge>
                      {ins.confidence && (
                        <StatusBadge tone="default">{ins.confidence}</StatusBadge>
                      )}
                      {ins.severity && (
                        <StatusBadge tone={sevTone}>{ins.severity}</StatusBadge>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[var(--brand)] mb-2">
                      {ins.display_label ?? formatDriverLabel(ins.feature, rawColumnNames)}
                    </h3>
                    <p className="text-sm leading-relaxed text-[var(--text-1)]">{ins.summary}</p>
                    {ins.investigation_questions?.length ? (
                      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)] mb-2">
                          Investigate
                        </p>
                        <ul className="space-y-1.5">
                          {ins.investigation_questions.map((q, qi) => (
                            <li
                              key={qi}
                              className="flex items-start gap-2 text-xs text-[var(--text-2)]"
                            >
                              <span
                                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-3)]"
                                aria-hidden
                              />
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
