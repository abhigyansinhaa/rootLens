import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { Card, CardEyebrow, Input, PageHeader, StatusBadge } from '../../components/ui'
import { UploadCloud, FileType, CheckCircle2, AlertCircle } from 'lucide-react'

export function Upload() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [progress, setProgress] = useState(false)
  const [success, setSuccess] = useState(false)
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
        
        // Success animation state
        setProgress(false)
        setSuccess(true)
        setTimeout(() => {
          navigate(`/datasets/${data.id}`)
        }, 1000)
      } catch (e: unknown) {
        setProgress(false)
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
      }
    },
    [name, navigate, qc],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDrag(false)
      if (progress || success) return
      const f = e.dataTransfer.files[0]
      if (f) void uploadFile(f)
    },
    [uploadFile, progress, success],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in-up">
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

      <Card padding="lg" elevated className="glass border-t-brand-500 border-t-2">
        <CardEyebrow>Workflow stage 1 of 3</CardEyebrow>
        <h2 className="mt-2 text-lg font-black tracking-tight text-[var(--text-1)]">
          Bring your data into the cockpit
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          We accept tidy tables with one row per observation. Pick the file, name it, and we will profile
          columns automatically.
        </p>

        <div className="mt-6 animate-slide-in-left delay-100">
          <Input
            label="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q4 churn cohort"
            disabled={progress || success}
            hint="Used in the inventory list. Defaults to the filename."
            className="transition-all focus:ring-brand-500"
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !progress && !success) document.getElementById('file-input')?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!progress && !success) setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`group mt-8 relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 transition-all duration-300 px-6 py-16 animate-fade-in-up delay-200 ${
            success
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 cursor-default'
              : progress
                ? 'border-brand-500 bg-[var(--surface-2)] cursor-wait'
                : drag
                  ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/30 scale-[1.02]'
                  : 'border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] hover:border-brand-400 hover:bg-[var(--surface-2)] hover:shadow-lg hover:shadow-brand-500/10'
          }`}
          onClick={() => {
            if (!progress && !success) document.getElementById('file-input')?.click()
          }}
        >
          {/* Animated dashed border effect for hover state */}
          {!progress && !success && (
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300">
              <svg className="w-full h-full text-brand-500/50" preserveAspectRatio="none">
                <rect 
                  width="100%" height="100%" fill="none" rx="16" 
                  stroke="currentColor" strokeWidth="2" strokeDasharray="8 8" 
                  className="animate-[shimmer_2s_linear_infinite]"
                  style={{ strokeDashoffset: drag ? 0 : 100 }}
                />
              </svg>
            </div>
          )}

          <input
            id="file-input"
            type="file"
            accept=".csv,.parquet,.pq"
            className="hidden"
            disabled={progress || success}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadFile(f)
            }}
          />

          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-500 ${
              success
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 scale-110'
                : drag || progress
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/40 scale-110'
                  : 'bg-brand-100 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-500/30 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-brand-500/20 group-hover:bg-brand-500 group-hover:text-white group-hover:ring-transparent'
            }`}>
              {success ? (
                <CheckCircle2 className="h-8 w-8 animate-fade-in-scale" />
              ) : (
                <UploadCloud className={`h-8 w-8 transition-transform duration-300 ${drag ? '-translate-y-1' : ''}`} />
              )}
            </div>
            
            <p className="mt-6 text-center text-lg font-black tracking-tight text-[var(--text-1)] transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
              {success ? 'Upload Complete!' : progress ? 'Uploading & Profiling Schema…' : 'Drag file here or click to browse'}
            </p>
            
            {!success && !progress && (
              <div className="mt-3 flex items-center justify-center gap-4 text-xs font-medium text-[var(--text-3)]">
                <span className="flex items-center gap-1.5"><FileType className="h-4 w-4" /> CSV</span>
                <span className="flex items-center gap-1.5"><FileType className="h-4 w-4" /> Parquet</span>
              </div>
            )}
          </div>

          {progress && (
            <div className="absolute bottom-0 left-0 h-1.5 w-full bg-[var(--surface-3)]">
              <div className="h-full w-full bg-brand-500 animate-shimmer" />
            </div>
          )}
        </div>

        <ul className="mt-8 grid gap-4 text-sm text-[var(--text-2)] sm:grid-cols-3 animate-fade-in-up delay-300">
          <li className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-colors hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]">
            <div className="absolute top-0 left-0 h-1 w-full bg-blue-500/50" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Profiled</p>
            <p className="mt-1 text-[var(--text-1)] font-medium">Columns, types, and null ratios.</p>
          </li>
          <li className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-colors hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]">
            <div className="absolute top-0 left-0 h-1 w-full bg-indigo-500/50" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Inferred</p>
            <p className="mt-1 text-[var(--text-1)] font-medium">Likely target type for guided next step.</p>
          </li>
          <li className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-colors hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]">
            <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500/50" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Private</p>
            <p className="mt-1 text-[var(--text-1)] font-medium">Stored in your workspace, not shared.</p>
          </li>
        </ul>

        {err && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-700 dark:text-red-400 animate-fade-in-scale">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-bold">Upload Failed</p>
              <p className="mt-0.5">{err}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
