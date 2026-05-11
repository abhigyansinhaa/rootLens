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
  if (col.dtype === 'object' || col.dtype === 'bool' || col.dtype === 'category') return 'classification'
  if (col.n_unique <= 20) return 'classification'
  return 'regression'
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
    <div className="space-y-10">
      <Link
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-600 hover:underline dark:text-brand-300"
        to="/datasets"
      >
        <span aria-hidden>←</span> Datasets
      </Link>

      <PageHeader
        eyebrow="Dataset workbench"
        title={ds.name}
        description={`${ds.rows.toLocaleString()} rows · ${ds.cols} columns · ${ds.file_format.toUpperCase()}`}
        meta={
          <>
            <StatusBadge tone="info" dot>
              Step 2 of 3 · Configure
            </StatusBadge>
            {taskHint && <StatusBadge tone="success">{taskHint} task</StatusBadge>}
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
            onClick={() => {
              if (confirm('Delete this dataset and all analyses?')) delMutation.mutate()
            }}
          >
            Delete dataset
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rows" value={ds.rows.toLocaleString()} hint="Records under coverage" />
        <Stat label="Columns" value={ds.cols.toLocaleString()} hint="Including target" />
        <Stat
          label="Avg null rate"
          value={`${(avgNullRatio * 100).toFixed(1)}%`}
          tone={avgNullRatio < 0.05 ? 'success' : avgNullRatio < 0.2 ? 'warning' : 'risk'}
        />
        <Stat label="Format" value={ds.file_format.toUpperCase()} hint="Native parser" />
      </section>

      <Card padding="lg" tone="info" elevated>
        <CardEyebrow>Run controls</CardEyebrow>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[var(--text-1)]">
          Run root-cause analysis
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          Select the target variable. We infer classification vs regression from the column. Optionally bind a
          revenue or value column to get monetized impact.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Select
            label="Target column"
            id="target-col"
            value={effectiveTarget}
            onChange={(e) => {
              setTarget(e.target.value)
              setValuePick('__auto__')
              setDatetimePick('__none__')
            }}
          >
            {ds.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Value column (optional)"
            id="value-col"
            disabled={numericSelectable.length === 0}
            value={valuePick}
            onChange={(e) => setValuePick(e.target.value)}
            hint={
              numericSelectable.length === 0
                ? 'No numeric columns available for monetization overlay.'
                : 'Bind a numeric column for revenue-linked KPIs.'
            }
          >
            <option value="__auto__">Auto ({suggestedValue || 'detect numeric column'})</option>
            <option value="__none__">Skip revenue/value KPI overlay</option>
            {numericSelectable.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4 max-w-xl">
          <Select
            label="Time column (optional)"
            id="datetime-col"
            value={datetimePick}
            onChange={(e) => setDatetimePick(e.target.value)}
            hint="Sort rows chronologically and use walk-forward CV on the training window. Leave unset for standard randomized splits."
          >
            <option value="__none__">None — standard randomized CV</option>
            {datetimeSelectable.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.dtype})
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {taskHint && <StatusBadge tone="success">Inferred {taskHint}</StatusBadge>}
          {numericSelectable.length === 0 ? (
            <StatusBadge tone="warning">No value overlay available</StatusBadge>
          ) : (
            <StatusBadge tone="info">{numericSelectable.length} numeric columns available</StatusBadge>
          )}
        </div>
        {runMutation.isError && (
          <p
            className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {formatStartError(runMutation.error)}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={runMutation.isPending || !effectiveTarget}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending ? 'Starting…' : 'Run root-cause analysis'}
          </Button>
          <span className="text-xs text-[var(--text-3)]">
            Test split: <span className="tabular-nums font-semibold text-[var(--text-2)]">20%</span>
          </span>
        </div>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Profile"
          title="Schema readiness"
          description="Review column types, null rates, and cardinality before choosing the target."
        />
        <DataTable>
          <THead>
            <tr>
              <TH>Column</TH>
              <TH>Type</TH>
              <TH align="right">Null %</TH>
              <TH align="right">Unique</TH>
              <TH align="right">Health</TH>
            </tr>
          </THead>
          <TBody>
            {ds.columns.map((c) => (
              <TR key={c.name}>
                <TD mono>{c.name}</TD>
                <TD>
                  <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-2)]">
                    {c.dtype}
                  </span>
                </TD>
                <TD align="right" numeric>
                  {(c.null_ratio * 100).toFixed(1)}%
                </TD>
                <TD align="right" numeric>
                  {c.n_unique.toLocaleString()}
                </TD>
                <TD align="right">
                  <StatusBadge tone={nullTone(c.null_ratio)} dot>
                    {nullTone(c.null_ratio) === 'success'
                      ? 'OK'
                      : nullTone(c.null_ratio) === 'warning'
                        ? 'Watch'
                        : 'Risk'}
                  </StatusBadge>
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </section>

      {preview && preview.rows.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Preview"
            title="Data preview"
            description="Spot check the first rows before running the RCA model."
          />
          <Card padding="none" tone="strong">
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-[var(--border-1)] bg-[var(--surface-3)] text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-3)]">
                  <tr>
                    {preview.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-3 py-2.5 font-bold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-1)]">
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--surface-3)]/50">
                      {preview.columns.map((col) => (
                        <td
                          key={col}
                          className="max-w-xs truncate px-3 py-1.5 font-mono text-[11px] text-[var(--text-2)]"
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

      <DatasetKpiDashboard datasetId={datasetId} datasetName={ds.name} />
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
