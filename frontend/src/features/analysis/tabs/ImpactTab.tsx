import type { Analysis, AnalysisKpis } from '../../../types'
import { ConcentrationCallout, CounterfactualCallout } from '../../../components/kpi'
import { MetricRunway } from '../../../components/kpi/MetricRunway'
import { StatusBadge } from '../../../components/ui'
import { formatDriverLabel } from '../../../lib/driverLabels'
import { WhatIfSimulator } from '../WhatIfSimulator'

interface ImpactTabProps {
  data: Analysis
  kpis: AnalysisKpis
  rawColumnNames: string[]
  kpiHistory?: import('../../../types').KpiHistoryResponse
}

export function ImpactTab({ data, kpis, rawColumnNames, kpiHistory }: ImpactTabProps) {
  return (
    <div className="space-y-12 print:block">
      <MetricRunway detail={data} kpis={kpis} history={kpiHistory} rawColumns={rawColumnNames} />

      <div className="grid gap-8 lg:grid-cols-2">
        <ConcentrationCallout kpis={kpis} />
        <CounterfactualCallout
          kpis={kpis}
          regression={data.task_type === 'regression'}
          trustCopy={data.report?.trust_copy}
        />
      </div>

      <WhatIfSimulator kpis={kpis} rawColumns={rawColumnNames} />

      {data.insights && data.insights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-(--text-1)">Why is this happening?</h3>
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.insights.map((ins, i) => {
              const sevTone = ins.severity === 'critical' ? 'risk' : 'warning'
              return (
                <li key={i}>
                  <div className="h-full rounded-lg bg-(--surface-1) p-5 border border-(--border-subtle)">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StatusBadge tone="info">{ins.kind}</StatusBadge>
                      {ins.confidence && <StatusBadge tone="default">{ins.confidence}</StatusBadge>}
                      {ins.severity && <StatusBadge tone={sevTone}>{ins.severity}</StatusBadge>}
                    </div>
                    <h4 className="text-sm font-semibold text-(--brand) mb-2">
                      {ins.display_label ?? formatDriverLabel(ins.feature, rawColumnNames)}
                    </h4>
                    <p className="text-sm leading-relaxed text-(--text-2)">{ins.summary}</p>
                    {ins.investigation_questions?.length ? (
                      <ul className="mt-3 space-y-1.5">
                        {ins.investigation_questions.map((q, qi) => (
                          <li key={qi} className="flex items-start gap-2 text-xs text-(--text-3)">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-(--text-3)" aria-hidden />
                            {q}
                          </li>
                        ))}
                      </ul>
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
