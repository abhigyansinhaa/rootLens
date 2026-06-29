import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { DatasetKpiDashboard } from './DatasetKpiDashboard'
import { ConfigureAnalysis } from '../analysis/ConfigureAnalysis'
import {
  Button,
  Card,
  ConfirmModal,
  DatasetColumnCard,
  PageHeader,
  SectionHeader,
  Stat,
  StatusBadge,
  useToast,
  DataTable, THead, TBody, TR, TH, TD
} from '../../components/ui'
import { Trash2, ArrowLeft, Activity } from 'lucide-react'
import type { Dataset } from '../../types'
import { DatasetDetailSkeleton } from '../../components/PageSkeletons'


function DatasetDetailInner({ datasetId }: { datasetId: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { success: toastSuccess, error: toastError } = useToast()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

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


  if (isLoading || !ds) {
    return <DatasetDetailSkeleton />
  }


  const avgNullRatio =
    ds.columns.length > 0
      ? ds.columns.reduce((s, c) => s + (c.null_ratio ?? 0), 0) / ds.columns.length
      : 0

  return (
    <div className="space-y-8 animate-fade-in-up">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-(--text-3) hover:text-(--brand) transition-colors"
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
        <Stat label="Format" value={ds.file_format.toUpperCase()} hint="Native parser" />
      </section>

      {/* Configuration Panel */}
      <ConfigureAnalysis dataset={ds} />

      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Profile"
            title="Schema Readiness"
            description="Review columns and quality before running."
          />
          <Card padding="lg" className="border-t-4 border-t-(--success)">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-(--text-2)">Dataset Health</p>
                <p className="text-3xl font-black text-(--text-1) tabular-nums">
                  <span className="inline-block">{healthScore}/100</span>
                </p>
              </div>
              <Activity className="h-8 w-8 text-(--success) opacity-80" />
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
              <div className="max-h-[500px] overflow-auto custom-scrollbar rounded-lg">
                <DataTable className="border-0">
                  <THead>
                    <TR>
                      {preview.columns.map((col) => (
                        <TH key={col} className={`whitespace-nowrap sticky top-0 z-10 bg-(--surface-3)`}>
                          {col}
                        </TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {preview.rows.map((row, i) => (
                      <TR key={i} className="group">
                        {preview.columns.map((col) => (
                          <TD
                            key={col}
                            className={`max-w-[200px] truncate font-mono text-[11px] tabular-nums text-(--text-2)`}
                            title={row[col] ?? ''}
                          >
                            {row[col] ?? ''}
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </DataTable>
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
        <p className="text-sm font-medium text-(--critical)">Invalid dataset id.</p>
        <Button variant="secondary" className="mt-4" to="/datasets">
          Back to datasets
        </Button>
      </Card>
    )
  }

  return <DatasetDetailInner key={id} datasetId={datasetId} />
}
