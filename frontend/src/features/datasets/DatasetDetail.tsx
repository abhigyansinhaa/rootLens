import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { DatasetKpiDashboard } from './DatasetKpiDashboard'
import {
  Button,
  Card,
  ConfirmModal,
  DatasetColumnCard,
  PageHeader,
  SectionHeader,
  Select,
  Stat,
  StatusBadge,
  useToast,
  ShinyText,
} from '../../components/ui'
import { PlayCircle, Trash2, ArrowLeft, Activity, Target, Settings2, Sparkles, CheckCircle2 } from 'lucide-react'
import type { Analysis, ColumnSchema, Dataset } from '../../types'
import { DatasetDetailSkeleton } from '../../components/PageSkeletons'

function fallbackColumnName(columns: ColumnSchema[]): string {
  const named = columns.find((c) => c.name?.trim())?.name
  return named ?? columns[0]?.name ?? ''
}

function pickDefaultTarget(columns: ColumnSchema[]): string {
  if (!columns.length) return ''
  const names = columns.map((c) => c.name)
  const preferred = ['churned', 'churn', 'target', 'label', 'outcome', 'y']
  for (const p of preferred) {
    const hit = names.find((n) => n.toLowerootLensse() === p)
    if (hit) return hit
  }
  const fb = fallbackColumnName(columns)
  if (fb.toLowerootLensse() === 'customer_id' || fb.toLowerootLensse().endsWith('_id')) {
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
  const dt = String(c.dtype).toLowerootLensse()
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

  const lower = candidates.map((c) => ({ name: c.name, lc: c.name.toLowerootLensse().replace(/\s+/g, '') }))
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

function DatasetDetailInner({ datasetId }: { datasetId: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [target, setTarget] = useState('')
  const [valuePick, setValuePick] = useState<string>('__auto__')
  const [datetimePick, setDatetimePick] = useState<string>('__none__')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [advancedMode, setAdvancedMode] = useState(false)

  const { data: ds, isLoading } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: async () => {
      const { data } = await api.get<Dataset>(`/datasets/${datasetId}`)
      return data
    },
    enabled: Number.isFinite(datasetId),
  })

  const { data: preview } = useQuery({
    queryKey: ['preview', datasetId],
    queryFn: async () => {
      const { data } = await api.get<{ rows: Record<string, string>[]; columns: string[] }>(
        `/datasets/${datasetId}/preview`,
      )
      return data
    },
    enabled: Number.isFinite(datasetId),
  })

  const healthScore = useMemo(() => {
    if (!ds?.columns?.length) return 100
    const nulls = ds.columns.reduce((acc, c) => acc + c.null_ratio, 0) / ds.columns.length
    return Math.max(0, Math.round(100 - (nulls * 100)))
  }, [ds?.columns])

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!ds?.columns?.length) throw new Error('Dataset not loaded')
      const resolvedTarget = (target.trim() || pickDefaultTarget(ds.columns)).trim()
      if (!resolvedTarget) throw new Error('No target column')

      let vc: string | undefined
      const autoVc = pickDefaultValueColumn(ds.columns, resolvedTarget)

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

      const { data } = await api.post<Analysis>(`/datasets/${datasetId}/analyses`, {
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
      void qc.invalidateQueries({ queryKey: ['datasetAnalyses', datasetId] })
      toastSuccess('Analysis started successfully.', 'Running')
      navigate(`/analyses/${a.id}`)
    },
    onError: (err) => {
      toastError(formatStartError(err), 'Analysis failed to start')
    },
  })

  const delMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/datasets/${datasetId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['datasets'] })
      toastSuccess('Dataset and all analyses deleted.', 'Deleted')
      navigate('/datasets')
    },
    onError: () => {
      toastError('Could not delete the dataset. Please try again.', 'Delete failed')
    },
  })

  const defaultTarget = useMemo(
    () => (ds?.columns?.length ? pickDefaultTarget(ds.columns) : ''),
    [ds],
  )

  if (isLoading || !ds) {
    return <DatasetDetailSkeleton />
  }

  const effectiveTarget = target.trim() || defaultTarget
  const hint = ds.columns.find((c) => c.name === effectiveTarget)
  const taskHint = hint ? inferTaskHint(hint) : ''

  const numericSelectable = ds.columns.filter((c) => isNumericColumn(c) && c.name !== effectiveTarget)
  const suggestedValue = pickDefaultValueColumn(ds.columns, effectiveTarget)

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

  const datetimeSelectable = ds.columns.filter(
    (c) => c.name !== effectiveTarget && c.name !== resolvedValueCol,
  )

  const avgNullRatio =
    ds.columns.length > 0
      ? ds.columns.reduce((s, c) => s + (c.null_ratio ?? 0), 0) / ds.columns.length
      : 0

  return (
    <div className="space-y-8 animate-fade-in-up">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--text-3) hover:text-brand-500 transition-colors"
        to="/datasets"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Datasets
      </Link>

      <PageHeader
        eyebrow="Dataset Workbench"
        title={ds.name}
        description={`${ds.rows.toLocaleString()} rows · ${ds.cols} columns · ${ds.file_format.toUpperootLensse()}`}
        meta={
          <>
            <StatusBadge tone="info" dot>Step 2 of 3 · Configure</StatusBadge>
            {taskHint && <StatusBadge tone="success">{taskHint}</StatusBadge>}
            <StatusBadge tone={avgNullRatio < 0.05 ? 'success' : avgNullRatio < 0.2 ? 'warning' : 'risk'}>
              Null avg {(avgNullRatio * 100).toFixed(1)}%
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              variant="danger"
              size="sm"
              type="button"
              className="shadow-sm"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete dataset
            </Button>
            <ConfirmModal
              open={confirmDeleteOpen}
              title="Delete this dataset?"
              message="This will permanently delete the dataset and all associated analyses. This action cannot be undone."
              confirmLabel="Yes, delete"
              variant="danger"
              onConfirm={() => { setConfirmDeleteOpen(false); delMutation.mutate() }}
              onCancel={() => setConfirmDeleteOpen(false)}
            />
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rows" value={ds.rows.toLocaleString()} hint="Records under coverage" />
        <Stat label="Columns" value={ds.cols.toLocaleString()} hint="Including target" />
        <Stat
          label="Avg null rate"
          value={`${(avgNullRatio * 100).toFixed(1)}%`}
          tone={avgNullRatio < 0.05 ? 'success' : avgNullRatio < 0.2 ? 'warning' : 'risk'}
        />
        <Stat label="Format" value={ds.file_format.toUpperootLensse()} hint="Native parser" />
      </section>

      {/* Configuration Panel */}
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
                  <Target className="h-4 w-4 text-(--c-info)" /> Target Variable
                  <span className="text-[10px] upperootLensse tracking-wider text-(--text-3) font-semibold ml-2 bg-(--surface-2) px-1.5 py-0.5 rounded">Required</span>
                </div>
                <Select
                  id="target-col"
                  value={effectiveTarget}
                  className="bg-(--surface-0) border-(--border-default) transition-colors focus:ring-(--c-info) w-full max-w-md shadow-sm"
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setValuePick('__auto__')
                    setDatetimePick('__none__')
                  }}
                >
                  {ds.columns.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </Select>
                <p className="text-xs text-(--text-3)">The business outcome you want to explain or predict (e.g., Churn, Conversion).</p>
              </div>

              {advancedMode && (
                <div className="space-y-6 pt-4 border-t border-(--border-subtle) animate-fade-in-up delay-75">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-(--text-1)">
                      <Sparkles className="h-4 w-4 text-(--c-warning)" /> Value Column (Monetization Overlay)
                    </div>
                    <Select
                      id="value-col"
                      disabled={numericSelectable.length === 0}
                      value={valuePick}
                      className="bg-(--surface-0) border-(--border-default) transition-colors focus:ring-(--c-warning) w-full max-w-md shadow-sm"
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
                      <Activity className="h-4 w-4 text-(--c-success)" /> Time Split Column
                    </div>
                    <Select
                      id="datetime-col"
                      value={datetimePick}
                      className="bg-(--surface-0) border-(--border-default) transition-colors focus:ring-(--c-success) w-full max-w-md shadow-sm"
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

            <div className="bg-(--surface-2) rounded-lg border border-(--border-subtle) p-4 w-full lg:w-72 space-y-4 shrink-0 self-start">
              <h3 className="text-xs font-bold text-(--text-1) upperootLensse tracking-widest border-b border-(--border-subtle) pb-2">Analysis Context</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-(--text-3)">Task Type</span>
                  <span className="font-semibold text-(--text-1)">{taskHint || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-3)">Test Split</span>
                  <span className="font-semibold text-(--text-1)">20% (Holdout)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-3)">Optimization</span>
                  <span className="font-semibold text-(--text-1)">{taskHint === 'Classification' ? 'Log Loss' : 'RMSE'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-3)">Value Column</span>
                  <span className="font-semibold text-(--text-1)">{resolvedValueCol || 'None'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-(--border-subtle)">
                <div className="flex items-start gap-2 text-xs text-(--text-3)">
                  <CheckCircle2 className="h-4 w-4 text-(--c-success) shrink-0 mt-0.5" />
                  <span>SHAP tree explainer will be automatically fitted to the final model.</span>
                </div>
              </div>
            </div>
          </div>

          {runMutation.isError && (
            <div className="mt-6 flex items-center gap-3 rounded-md border border-(--c-danger-border) bg-(--c-danger-bg) px-4 py-3 text-sm text-(--c-danger)">
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

      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Profile"
            title="Schema Readiness"
            description="Review columns and quality before running."
          />
          <Card padding="lg" className="border-t-4 border-t-(--c-success)">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-(--text-2)">Dataset Health</p>
                <p className="text-3xl font-black text-(--text-1) tabular-nums">
                  <ShinyText text={`${healthScore}/100`} className="inline-block" speed={3} />
                </p>
              </div>
              <Activity className="h-8 w-8 text-(--c-success) opacity-80" />
            </div>
            <p className="text-xs text-(--text-3) leading-relaxed">
              Based on missing values, column variance, and type distribution.
              {healthScore < 80 ? ' Consider imputing or dropping high-null columns.' : ' Ready for analysis.'}
            </p>
          </Card>

          <div className="grid gap-3 max-h-[500px] overflow-auto custom-scrollbar pr-2">
            {ds.columns.map(c => (
              <DatasetColumnCard key={c.name} col={c} />
            ))}
          </div>
        </section>

        {preview && preview.rows.length > 0 && (
          <section className="space-y-4 min-w-0">
            <SectionHeader
              eyebrow="Preview"
              title="Data Preview"
              description="First rows of the dataset."
            />
            <Card padding="none" tone="strong" className="overflow-hidden border border-(--border-subtle)">
              <div className="max-h-[500px] overflow-auto custom-scrollbar">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-(--surface-3)/90 backdrop-blur-sm shadow-sm text-[10px] font-black upperootLensse tracking-[0.16em] text-(--text-3)">
                    <tr>
                      {preview.columns.map((col) => (
                        <th key={col} className={`whitespace-nowrap px-4 py-3 font-bold border-b border-(--border-subtle) ${col === effectiveTarget ? 'text-brand-600 bg-brand-500/5 dark:text-brand-400' : ''}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border-subtle)">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-(--surface-2) transition-colors group">
                        {preview.columns.map((col) => (
                          <td
                            key={col}
                            className={`max-w-[200px] truncate px-4 py-2 font-mono text-[11px] tabular-nums ${col === effectiveTarget
                                ? 'text-brand-700 bg-brand-500/5 dark:text-brand-300 font-medium group-hover:bg-brand-500/10'
                                : 'text-(--text-2)'
                              }`}
                            title={row[col] ?? ''}
                          >
                            {row[col] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}
      </div>

      <div className="pt-8 mt-8 border-t border-(--border-subtle)">
        <DatasetKpiDashboard datasetId={datasetId} datasetName={ds.name} />
      </div>
    </div>
  )
}

export function DatasetDetail() {
  const { id } = useParams<{ id: string }>()
  const datasetId = Number(id)

  if (!Number.isFinite(datasetId)) {
    return (
      <Card padding="lg" tone="risk">
        <p className="text-sm font-medium text-red-800 dark:text-red-300">Invalid dataset id.</p>
        <Button variant="secondary" className="mt-4" to="/datasets">
          Back to datasets
        </Button>
      </Card>
    )
  }

  return <DatasetDetailInner key={id} datasetId={datasetId} />
}
