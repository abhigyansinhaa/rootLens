import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { Card, CardEyebrow, Input, PageHeader, Spinner, StatusBadge } from '../../components/ui'

export function Upload() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [progress, setProgress] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      setErr(null)
      setProgress(true)
      const fd = new FormData()
      fd.append('file', file)
      if (name.trim()) fd.append('name', name.trim())
      try {
        const { data } = await api.post('/datasets', fd)
        await qc.invalidateQueries({ queryKey: ['datasets'] })
        navigate(`/datasets/${data.id}`)
      } catch (e: unknown) {
        const msg =
          e &&
          typeof e === 'object' &&
          'response' in e &&
          e.response &&
          typeof e.response === 'object' &&
          'data' in e.response
        const detail =
          msg && typeof (e.response as { data?: { detail?: string } }).data?.detail === 'string'
            ? (e.response as { data: { detail: string } }).data.detail
            : 'Upload failed.'
        setErr(detail)
      } finally {
        setProgress(false)
      }
    },
    [name, navigate, qc],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDrag(false)
      const f = e.dataTransfer.files[0]
      if (f) void uploadFile(f)
    },
    [uploadFile],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Step 1 - Ingest"
        title="Upload dataset"
        description="Start the RCA flow with a CSV or Parquet file. After upload we profile columns and guide target selection."
        meta={
          <>
            <StatusBadge tone="info">CSV</StatusBadge>
            <StatusBadge tone="info">Parquet</StatusBadge>
            <StatusBadge tone="success" dot>
              Schema profiled
            </StatusBadge>
            <StatusBadge tone="default">Private to your workspace</StatusBadge>
          </>
        }
      />

      <Card padding="lg" tone="strong" elevated>
        <CardEyebrow>Workflow stage 1 of 3</CardEyebrow>
        <h2 className="mt-2 text-lg font-black tracking-tight text-[var(--text-1)]">
          Bring your data into the cockpit
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          We accept tidy tables with one row per observation. Pick the file, name it, and we will profile
          columns automatically.
        </p>

        <div className="mt-6">
          <Input
            label="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q4 churn cohort"
            disabled={progress}
            hint="Used in the inventory list. Defaults to the filename."
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 transition-colors ${
            drag
              ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/30'
              : 'border-[var(--border-1)] bg-[var(--surface-1)] hover:border-[var(--border-2)] hover:bg-[var(--surface-3)]/40'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.parquet,.pq"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadFile(f)
            }}
          />
          <div className="rounded-2xl bg-brand-100 p-4 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-900">
            {progress ? (
              <Spinner className="h-8 w-8" />
            ) : (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>
          <p className="mt-5 text-center text-base font-black tracking-tight text-[var(--text-1)]">
            {progress ? 'Uploading…' : 'Drop a file here or click to browse'}
          </p>
          <p className="mt-2 text-center text-[11px] uppercase tracking-[0.18em] text-[var(--text-3)]">
            Accepted: .csv · .parquet · .pq
          </p>
        </div>

        <ul className="mt-6 grid gap-3 text-xs text-[var(--text-2)] sm:grid-cols-3">
          <li className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-3)]">Profiled</p>
            <p className="mt-1 text-[var(--text-1)]">Columns, types, and null ratios.</p>
          </li>
          <li className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-3)]">Inferred</p>
            <p className="mt-1 text-[var(--text-1)]">Likely target type for guided next step.</p>
          </li>
          <li className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-1)] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-3)]">Private</p>
            <p className="mt-1 text-[var(--text-1)]">Stored in your workspace, not shared.</p>
          </li>
        </ul>

        {err && (
          <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </p>
        )}
      </Card>
    </div>
  )
}
