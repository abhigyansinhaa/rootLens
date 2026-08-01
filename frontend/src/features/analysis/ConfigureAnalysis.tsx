import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Button, Card, Select, useToast } from '../../components/ui'
import { PlayCircle, Target, Settings2, Sparkles, Activity, CheckCircle2 } from 'lucide-react'
import type { Analysis, ColumnSchema, Dataset } from '../../types'

function fallbackColumnName(columns: ColumnSchema[]): string {
  const named = columns.find((c) => c.name?.trim())?.name
  return named ?? columns[0]?.name ?? ''
}

function pickDefaultTarget(columns: ColumnSchema[]): string {
  if (!columns.length) return ''
  const names = columns.map((c) => c.name)
  const preferred = ['churned', 'churn', 'target', 'label', 'outcome', 'y']
  for (const p of preferred) {
    const hit = names.find((n) => n.toLowerCase() === p)
    if (hit) return hit
  }
  const fb = fallbackColumnName(columns)
  if (fb.toLowerCase() === 'customer_id' || fb.toLowerCase().endsWith('_id')) {
    const last = names[names.length - 1]
    if (last && last !== fb) return last
  }
  return fb
}

function formatStartError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (isAxiosError(err)) {
    const d = err.response?.data as { detail?: string | { msg: string }[] } | undefined
    if (typeof d?.detail === 'string') return d.detail
    if (Array.isArray(d?.detail)) return d.detail.map((x) => x.msg).join('; ')
    if (err.response?.status === 401) return 'Not authenticated. Log in and try again.'
    if (err.response?.status === 429) {
      return 'Too many analysis requests. Try again in about an hour.'
    }
    if (err.response?.status === 503 || err.response?.status === 500) {
      return 'Server error while starting analysis. If you use Docker, ensure Redis and DB migrations are applied.'
    }
  }
  return 'Could not start analysis. Check the target column or try again.'
}

function inferTaskHint(col: { dtype: string; n_unique: number }) {
  if (col.dtype === 'object' || col.dtype === 'bool' || col.dtype === 'category') return 'Classification'
  if (col.n_unique <= 20) return 'Classification'
  return 'Regression'
}

function isNumericColumn(c: ColumnSchema) {
  const dt = String(c.dtype).toLowerCase()
  return (
    dt.includes('float') ||
    dt.includes('int') ||
    dt.includes('uint') ||
    dt.includes('decimal') ||
    dt.includes('numeric')
  )
}

function pickDefaultValueColumn(columns: ColumnSchema[], target: string): string {
  const candidates = columns.filter((c) => isNumericColumn(c) && c.name !== target)
  if (!candidates.length) return ''

  const lower = candidates.map((c) => ({ name: c.name, lc: c.name.toLowerCase().replace(/\s+/g, '') }))
  const preferred = [
    'monthly_charges',
    'monthlycharges',
    'arpu',
    'revenue',
    'mrr',
    'value',
    'ltv',
    'lifetime_value',
  ]

  for (const p of preferred) {
    const hit = lower.find(
      (x) => x.lc.includes(p.replace(/_/g, '')) || x.lc.endsWith(p.replace(/_/g, '')),
    )
    if (hit) return hit.name
  }

  return candidates[0]?.name ?? ''
}

export function ConfigureAnalysis({ dataset }: { dataset: Dataset }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  
  const [target, setTarget] = useState('')
  const [valuePick, setValuePick] = useState<string>('__auto__')
  const [datetimePick, setDatetimePick] = useState<string>('__none__')
  const [advancedMode, setAdvancedMode] = useState(false)

  const defaultTarget = useMemo(
    () => (dataset?.columns?.length ? pickDefaultTarget(dataset.columns) : ''),
    [dataset],
  )
  
  const effectiveTarget = target.trim() || defaultTarget
  const hint = dataset.columns.find((c) => c.name === effectiveTarget)
  const taskHint = hint ? inferTaskHint(hint) : ''

  const numericSelectable = dataset.columns.filter((c) => isNumericColumn(c) && c.name !== effectiveTarget)
  const suggestedValue = pickDefaultValueColumn(dataset.columns, effectiveTarget)

  let resolvedValueCol: string | undefined
  if (!valuePick || valuePick === '__auto__') {
    resolvedValueCol = suggestedValue || undefined
  } else if (valuePick === '__none__') {
    resolvedValueCol = undefined
  } else {
    resolvedValueCol = valuePick
  }
  if (resolvedValueCol === effectiveTarget) {
    resolvedValueCol = undefined
  }

  const datetimeSelectable = dataset.columns.filter(
    (c) => c.name !== effectiveTarget && c.name !== resolvedValueCol,
  )

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!dataset?.columns?.length) throw new Error('Dataset not loaded')
      const resolvedTarget = (target.trim() || pickDefaultTarget(dataset.columns)).trim()
      if (!resolvedTarget) throw new Error('No target column')

      let vc: string | undefined
      const autoVc = pickDefaultValueColumn(dataset.columns, resolvedTarget)

      if (!valuePick || valuePick === '__auto__') {
        vc = autoVc || undefined
      } else if (valuePick === '__none__') {
        vc = undefined
      } else {
        vc = valuePick
      }

      if (vc === resolvedTarget) {
        vc = undefined
      }

      const { data } = await api.post<Analysis>(`/datasets/${dataset.id}/analyses`, {
        target: resolvedTarget,
        test_size: 0.2,
        ...(vc ? { value_column: vc } : {}),
        ...(datetimePick && datetimePick !== '__none__' ? { datetime_column: datetimePick } : {}),
      })
      return data
    },
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: ['analysis', a.id] })
      void qc.invalidateQueries({ queryKey: ['analyses'] })
      void qc.invalidateQueries({ queryKey: ['datasetAnalyses', dataset.id] })
      toastSuccess('Analysis started successfully.', 'Running')
      navigate(`/analyses/${a.id}`)
    },
    onError: (err) => {
      toastError(formatStartError(err), 'Analysis failed to start')
    },
  })

  return (
    <Card padding="none" className="overflow-hidden border border-(--border-subtle) bg-(--surface-1)">
      <div className="flex items-center justify-between border-b border-(--border-subtle) px-6 py-4 bg-(--surface-2)">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-(--text-2)" />
          <h2 className="text-base font-bold text-(--text-1)">Analysis Configuration</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-(--text-3)">Mode:</span>
          <div className="flex rounded-md border border-(--border-subtle) bg-(--surface-1) p-0.5">
            <button
              onClick={() => setAdvancedMode(false)}
              className={`px-3 py-1 text-xs font-bold rounded-sm transition-colors ${!advancedMode ? 'bg-(--surface-3) text-(--text-1) shadow-sm' : 'text-(--text-3) hover:text-(--text-1)'}`}
            >
              Standard
            </button>
            <button
              onClick={() => setAdvancedMode(true)}
              className={`px-3 py-1 text-xs font-bold rounded-sm transition-colors flex items-center gap-1 ${advancedMode ? 'bg-(--surface-3) text-(--text-1) shadow-sm' : 'text-(--text-3) hover:text-(--text-1)'}`}
            >
              Advanced
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-(--text-1)">
                <Target className="h-4 w-4 text-(--info)" /> Target Variable
                <span className="text-[10px] uppercase tracking-wider text-(--text-3) font-semibold ml-2 bg-(--surface-2) px-1.5 py-0.5 rounded">Required</span>
              </div>
              <Select
                id="target-col"
                value={effectiveTarget}
                className="bg-(--app-bg) border-(--border-default) transition-colors focus:ring-(--info) w-full max-w-md shadow-sm"
                onChange={(e) => {
                  setTarget(e.target.value)
                  setValuePick('__auto__')
                  setDatetimePick('__none__')
                }}
              >
                {dataset.columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </Select>
              <p className="text-xs text-(--text-3)">The business outcome you want to explain or predict (e.g., Churn, Conversion).</p>
            </div>

            {advancedMode && (
              <div className="space-y-6 pt-4 border-t border-(--border-subtle) animate-fade-in-up delay-75">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-(--text-1)">
                    <Sparkles className="h-4 w-4 text-(--warning)" /> Value Column (Monetization Overlay)
                  </div>
                  <Select
                    id="value-col"
                    disabled={numericSelectable.length === 0}
                    value={valuePick}
                    className="bg-(--app-bg) border-(--border-default) transition-colors focus:ring-(--warning) w-full max-w-md shadow-sm"
                    onChange={(e) => setValuePick(e.target.value)}
                  >
                    <option value="__auto__">Auto ({suggestedValue || 'detect numeric column'})</option>
                    <option value="__none__">Skip revenue/value overlay</option>
                    {numericSelectable.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-(--text-3)">Used to calculate ROI and financial impact of drivers.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-(--text-1)">
                    <Activity className="h-4 w-4 text-(--success)" /> Time Split Column
                  </div>
                  <Select
                    id="datetime-col"
                    value={datetimePick}
                    className="bg-(--app-bg) border-(--border-default) transition-colors focus:ring-(--success) w-full max-w-md shadow-sm"
                    onChange={(e) => setDatetimePick(e.target.value)}
                  >
                    <option value="__none__">Standard randomized CV</option>
                    {datetimeSelectable.map((c) => (
                      <option key={c.name} value={c.name}>{c.name} ({c.dtype})</option>
                    ))}
                  </Select>
                  <p className="text-xs text-(--text-3)">Use chronological splitting instead of random holdout for time-series data.</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-(--surface-2) rounded-lg border border-(--border-subtle) p-4.5 w-full lg:w-80 space-y-4 shrink-0 self-start">
            <h3 className="text-xs font-bold text-(--text-1) uppercase tracking-widest border-b border-(--border-subtle) pb-2">Analysis Context</h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="text-(--text-3) shrink-0">Task Type</span>
                <span className="font-semibold text-(--text-1) truncate">{taskHint || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="text-(--text-3) shrink-0">Test Split</span>
                <span className="font-semibold text-(--text-1) shrink-0">20% (Holdout)</span>
              </div>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="text-(--text-3) shrink-0">Optimization</span>
                <span className="font-semibold text-(--text-1) shrink-0">{taskHint === 'Classification' ? 'Log Loss' : 'RMSE'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="text-(--text-3) shrink-0">Value Column</span>
                <span
                  className="font-mono text-xs font-semibold text-(--text-1) truncate max-w-[150px] text-right"
                  title={resolvedValueCol || 'None'}
                >
                  {resolvedValueCol || 'None'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-(--border-subtle)">
              <div className="flex items-start gap-2 text-xs text-(--text-3)">
                <CheckCircle2 className="h-4 w-4 text-(--success) shrink-0 mt-0.5" />
                <span>SHAP tree explainer will be automatically fitted to the final model.</span>
              </div>
            </div>
          </div>
        </div>

        {runMutation.isError && (
          <div className="mt-6 flex items-center gap-3 rounded-md border border-(--critical-border) bg-(--critical-bg) px-4 py-3 text-sm text-(--critical)">
            <span className="font-bold">Error:</span> {formatStartError(runMutation.error)}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-(--border-subtle) flex items-center justify-between">
          <Button
            type="button"
            className="bg-(--brand) text-white shadow-sm hover:brightness-110 px-8 h-10 text-sm font-bold transition-all"
            disabled={runMutation.isPending || !effectiveTarget}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending ? (
              <>
                <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Initializing Pipeline…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" /> Start Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
