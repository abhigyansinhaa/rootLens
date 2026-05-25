import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { DatasetKpiDashboard } from './DatasetKpiDashboard'
import {
  Button,
  Card,
  CardEyebrow,
  DataTable,
  LoadingState,
  PageHeader,
  SectionHeader,
  Select,
  Stat,
  StatusBadge,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../../components/ui'
import { PlayCircle, Trash2, ArrowLeft, Activity, Target, Settings2, Sparkles, CheckCircle2 } from 'lucide-react'
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

function nullTone(ratio: number): 'success' | 'warning' | 'risk' {
  if (ratio < 0.05) return 'success'
  if (ratio < 0.25) return 'warning'
  return 'risk'
}

function DatasetDetailInner({ datasetId }: { datasetId: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [target, setTarget] = useState('')
  const [valuePick, setValuePick] = useState<string>('__auto__')
  const [datetimePick, setDatetimePick] = useState<string>('__none__')

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
      navigate(`/analyses/${a.id}`)
    },
  })

  const delMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/datasets/${datasetId}`)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['datasets'] })
      navigate('/datasets')
    },
  })

  const defaultTarget = useMemo(
    () => (ds?.columns?.length ? pickDefaultTarget(ds.columns) : ''),
    [ds],
  )

  if (isLoading || !ds) {
    return <LoadingState rows={2} message="Loading dataset…" />
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
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-3)] hover:text-brand-500 transition-colors"
        to="/datasets"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Datasets
      </Link>

      <PageHeader
        eyebrow="Dataset Workbench"
        title={ds.name}
        description={`${ds.rows.toLocaleString()} rows · ${ds.cols} columns · ${ds.file_format.toUpperCase()}`}
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
          <Button
            variant="danger"
            size="sm"
            type="button"
            className="shadow-sm"
            onClick={() => {
              if (confirm('Delete this dataset and all analyses?')) delMutation.mutate()
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete dataset
          </Button>
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
        <Stat label="Format" value={ds.file_format.toUpperCase()} hint="Native parser" />
      </section>

      {/* Glassmorphism Config Panel */}
      <Card padding="none" elevated className="glass overflow-hidden border-t-brand-500 border-t-2 relative">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="h-5 w-5 text-brand-500" />
            <CardEyebrow>Run controls</CardEyebrow>
          </div>
          <h2 className="text-xl font-black tracking-tight text-[var(--text-1)]">
            Run Root-Cause Analysis
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)] max-w-2xl">
            Select the target variable to explain. We'll train a robust model and use SHAP to extract global drivers and segment risks. Bind a value column to monetize the impact.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                <Target className="h-4 w-4 text-brand-500" /> Target Variable
              </div>
              <Select
                id="target-col"
                value={effectiveTarget}
                className="bg-[var(--surface-1)] transition-colors focus:ring-brand-500 w-full"
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
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                <Sparkles className="h-4 w-4 text-amber-500" /> Value Column (Optional)
              </div>
              <Select
                id="value-col"
                disabled={numericSelectable.length === 0}
                value={valuePick}
                className="bg-[var(--surface-1)] transition-colors focus:ring-amber-500 w-full"
                onChange={(e) => setValuePick(e.target.value)}
              >
                <option value="__auto__">Auto ({suggestedValue || 'detect numeric column'})</option>
                <option value="__none__">Skip revenue/value overlay</option>
                {numericSelectable.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                <Activity className="h-4 w-4 text-indigo-500" /> Time Split (Optional)
              </div>
              <Select
                id="datetime-col"
                value={datetimePick}
                className="bg-[var(--surface-1)] transition-colors focus:ring-indigo-500 w-full"
                onChange={(e) => setDatetimePick(e.target.value)}
              >
                <option value="__none__">Standard randomized CV</option>
                {datetimeSelectable.map((c) => (
                  <option key={c.name} value={c.name}>{c.name} ({c.dtype})</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {taskHint && <StatusBadge tone="success" dot className="bg-emerald-500/10">Inferred {taskHint}</StatusBadge>}
            {numericSelectable.length === 0 ? (
              <StatusBadge tone="warning">No value overlay available</StatusBadge>
            ) : (
              <StatusBadge tone="info" className="bg-blue-500/10">{numericSelectable.length} numeric columns</StatusBadge>
            )}
          </div>

          {runMutation.isError && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              <span className="font-bold">Error:</span> {formatStartError(runMutation.error)}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
            <Button
              type="button"
              className="bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-400 px-8 h-12 text-base font-bold transition-all"
              disabled={runMutation.isPending || !effectiveTarget}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending ? (
                <>
                  <span className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Starting Analysis…
                </>
              ) : (
                <>
                  <PlayCircle className="h-5 w-5 mr-2" /> Start Analysis
                </>
              )}
            </Button>
            <div className="flex items-center gap-2 text-sm text-[var(--text-3)] font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Test split: <span className="font-bold text-[var(--text-1)]">20%</span>
            </div>
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
          <Card padding="none" className="overflow-hidden">
            <div className="max-h-[500px] overflow-auto custom-scrollbar">
              <DataTable>
                <THead>
                  <tr className="sticky top-0 z-10 bg-[var(--surface-2)] shadow-sm">
                    <TH>Column</TH>
                    <TH>Type</TH>
                    <TH align="right">Null %</TH>
                    <TH align="right">Health</TH>
                  </tr>
                </THead>
                <TBody>
                  {ds.columns.map((c) => (
                    <TR key={c.name}>
                      <TD mono className={c.name === effectiveTarget ? 'text-brand-600 font-bold dark:text-brand-400' : ''}>
                        {c.name}
                      </TD>
                      <TD>
                        <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-2)] bg-[var(--surface-3)] px-1.5 py-0.5 rounded">
                          {c.dtype}
                        </span>
                      </TD>
                      <TD align="right" numeric className="tabular-nums">
                        {(c.null_ratio * 100).toFixed(1)}%
                      </TD>
                      <TD align="right">
                        <StatusBadge tone={nullTone(c.null_ratio)} dot className="scale-90 origin-right">
                          {nullTone(c.null_ratio) === 'success' ? 'OK' : nullTone(c.null_ratio) === 'warning' ? 'Watch' : 'Risk'}
                        </StatusBadge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </DataTable>
            </div>
          </Card>
        </section>

        {preview && preview.rows.length > 0 && (
          <section className="space-y-4 min-w-0">
            <SectionHeader
              eyebrow="Preview"
              title="Data Preview"
              description="First rows of the dataset."
            />
            <Card padding="none" tone="strong" className="overflow-hidden border border-[var(--border-subtle)]">
              <div className="max-h-[500px] overflow-auto custom-scrollbar">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-[var(--surface-3)]/90 backdrop-blur-sm shadow-sm text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-3)]">
                    <tr>
                      {preview.columns.map((col) => (
                        <th key={col} className={`whitespace-nowrap px-4 py-3 font-bold border-b border-[var(--border-subtle)] ${col === effectiveTarget ? 'text-brand-600 bg-brand-500/5 dark:text-brand-400' : ''}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--surface-2)] transition-colors group">
                        {preview.columns.map((col) => (
                          <td
                            key={col}
                            className={`max-w-[200px] truncate px-4 py-2 font-mono text-[11px] tabular-nums ${
                              col === effectiveTarget 
                                ? 'text-brand-700 bg-brand-500/5 dark:text-brand-300 font-medium group-hover:bg-brand-500/10' 
                                : 'text-[var(--text-2)]'
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

      <div className="pt-8 mt-8 border-t border-[var(--border-subtle)]">
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
