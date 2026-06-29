import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Activity, ArrowRight, Send, X } from 'lucide-react'
import type { Analysis, AnalysisKpis } from '../../types'
import { api } from '../../api/client'
import { buildAnalysisNarrative, type AnalysisNarrative } from '../../lib/analysisNarrative'
import { formatDriverLabel } from '../../lib/driverLabels'
import { StatusBadge } from './StatusBadge'

type Props = {
  analysis: Analysis
  kpis: AnalysisKpis
  rawColumns?: string[]
  highlightedDriver?: string | null
  onDriverHover?: (feature: string | null) => void
  onCitationClick?: (sectionId: string) => void
  onAction?: (action: string) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  className?: string
}

function confidenceTone(c: string): 'success' | 'warning' | 'risk' | 'default' {
  if (c === 'high') return 'success'
  if (c === 'low') return 'risk'
  if (c === 'medium') return 'warning'
  return 'default'
}

function CitationChip({
  id,
  label,
  confidence,
  onClick,
}: {
  id: number
  label: string
  confidence: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-(--surface-2) px-2 py-1 text-xs text-(--text-2) hover:bg-(--surface-3) hover:text-(--text-1) transition-colors"
    >
      <span className="font-mono text-(--brand)">[{id}]</span>
      <span>{label}</span>
      <StatusBadge tone={confidenceTone(confidence)} className="px-1 py-0 text-[9px] bg-transparent border-0 capitalize">
        {confidence}
      </StatusBadge>
    </button>
  )
}

function CopilotContent({
  analysis,
  kpis,
  rawColumns,
  narrative,
  highlightedDriver,
  onDriverHover,
  onCitationClick,
  onAction,
  followUp,
  setFollowUp,
}: {
  analysis: Analysis
  kpis: AnalysisKpis
  rawColumns?: string[]
  narrative: AnalysisNarrative
  highlightedDriver?: string | null
  onDriverHover?: (feature: string | null) => void
  onCitationClick?: (sectionId: string) => void
  onAction?: (action: string) => void
  followUp: string
  setFollowUp: (v: string) => void
}) {
  const topDriver = kpis.drivers[0]
  const topDriverName = topDriver ? formatDriverLabel(topDriver.feature, rawColumns) : null

  const handleFollowUp = () => {
    const q = followUp.trim().toLowerCase()
    if (!q) return
    if (q.includes('driver') || q.includes('cause')) onCitationClick?.('drivers-section')
    else if (q.includes('trust') || q.includes('model')) onCitationClick?.('trust-section')
    else if (q.includes('concentr') || q.includes('pareto')) onCitationClick?.('concentration-section')
    else if (q.includes('what') || q.includes('counter')) onAction?.('what-if')
    setFollowUp('')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-(--brand-dim) text-(--brand)">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-(--text-1)">Analyst</h2>
            <p className="text-[11px] text-(--text-3)">Grounded in run #{analysis.id}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-(--success)">
          <span className="status-dot status-dot-live bg-(--success)" />
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 text-sm text-(--text-2) leading-relaxed pr-1">
        <section>
          <p className="text-xs font-medium text-(--text-3) mb-2">Executive brief</p>
          <p className="text-(--text-1)">{narrative.executive_brief}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {narrative.citations.map((c) => (
              <CitationChip
                key={c.id}
                id={c.id}
                label={c.label}
                confidence={c.confidence}
                onClick={() => onCitationClick?.(c.sectionId)}
              />
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-medium text-(--text-3) mb-2">Concentration</p>
          <p>{narrative.concentration_insight}</p>
        </section>

        {narrative.driver_insight && topDriver && topDriverName && (
          <section>
            <p className="text-xs font-medium text-(--text-3) mb-2">Root cause</p>
            <p>
              {narrative.driver_insight.split(topDriverName)[0]}
              <strong
                className={[
                  'font-mono text-xs px-1 py-0.5 rounded transition-colors',
                  highlightedDriver === topDriver.feature
                    ? 'bg-(--brand) text-white'
                    : 'bg-(--brand-dim) text-(--brand)',
                ].join(' ')}
                onMouseEnter={() => onDriverHover?.(topDriver.feature)}
                onMouseLeave={() => onDriverHover?.(null)}
              >
                {topDriverName}
              </strong>
              {narrative.driver_insight.split(topDriverName)[1] ?? ''}
            </p>
          </section>
        )}

        {narrative.action_insight && (
          <section className="rounded-lg bg-(--brand-dimmer) p-3">
            <p className="text-xs font-medium text-(--text-3) mb-1">If you act</p>
            <p className="text-(--text-1)">{narrative.action_insight}</p>
          </section>
        )}
      </div>

      <div className="pt-4 mt-4 space-y-3">
        <p className="text-xs font-medium text-(--text-3)">Suggested actions</p>
        {narrative.suggested_actions.map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => onAction?.(a.action)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-(--surface-2) hover:bg-(--surface-3) transition-colors text-left group"
          >
            <span className="text-xs font-medium text-(--text-1)">{a.label}</span>
            <ArrowRight className="h-3.5 w-3.5 text-(--text-3) group-hover:text-(--brand)" />
          </button>
        ))}

        <div className="flex items-center gap-2 rounded-lg bg-(--surface-2) px-3 py-2">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
            placeholder="Ask a follow-up…"
            className="flex-1 bg-transparent text-sm text-(--text-1) placeholder:text-(--text-3) outline-none"
          />
          <button
            type="button"
            onClick={handleFollowUp}
            className="text-(--text-3) hover:text-(--brand) transition-colors"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}

export function AICopilot(props: Props) {
  const { analysis, kpis, rawColumns, mobileOpen, onMobileClose, className = '' } = props
  const [followUp, setFollowUp] = useState('')

  const { data: serverNarrative } = useQuery({
    queryKey: ['analysis-narrative', analysis.id],
    queryFn: async () => {
      const { data: raw } = await api.get<Record<string, unknown>>(`/analyses/${analysis.id}/narrative`)
      const citations = ((raw.citations as Array<Record<string, unknown>>) ?? []).map((c) => ({
        id: c.id as number,
        label: c.label as string,
        sectionId: (c.section_id ?? c.sectionId) as string,
        confidence: c.confidence as 'high' | 'medium' | 'low',
      }))
      return {
        executive_brief: raw.executive_brief as string,
        concentration_insight: raw.concentration_insight as string,
        driver_insight: (raw.driver_insight as string | null) ?? null,
        action_insight: (raw.action_insight as string | null) ?? null,
        citations,
        suggested_actions: (raw.suggested_actions as AnalysisNarrative['suggested_actions']) ?? [],
      } satisfies AnalysisNarrative
    },
    enabled: analysis.status === 'completed' || analysis.status === 'completed_with_warnings',
    staleTime: 60_000,
  })

  const fallback = useMemo(
    () => buildAnalysisNarrative(analysis, kpis, rawColumns),
    [analysis, kpis, rawColumns],
  )

  const narrative = serverNarrative ?? fallback

  const panel = (
    <div
      data-copilot
      className={[
        'flex flex-col h-full',
        className,
      ].join(' ')}
    >
      {mobileOpen && onMobileClose && (
        <button
          type="button"
          onClick={onMobileClose}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-(--surface-2) text-(--text-2) lg:hidden"
          aria-label="Close analyst"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <CopilotContent
        {...props}
        narrative={narrative}
        followUp={followUp}
        setFollowUp={setFollowUp}
      />
    </div>
  )

  return panel
}

export function AICopilotFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-(--brand) px-4 py-3 text-sm font-medium text-white shadow-(--shadow-overlay) hover:brightness-110 transition-all lg:hidden print:hidden"
      aria-label="Open AI analyst"
    >
      <Activity className="h-4 w-4" />
      Analyst
    </button>
  )
}

export function AICopilotSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden print:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-(--app-bg) p-5 overflow-hidden animate-slide-in-right flex flex-col">
        {children}
      </div>
    </div>
  )
}
