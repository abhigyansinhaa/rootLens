import { useCallback, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { Button, Input, PageHeader, StatusBadge } from '../../components/ui'
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Zap, Shield, BarChart3, DatabaseZap } from 'lucide-react'
import { DEMO_CSV } from './demoData'

const FEATURES = [
  {
    icon: Zap,
    color: 'var(--c-warning)',
    bg:    'var(--c-warning-bg)',
    border:'var(--c-warning-border)',
    title: 'Instant SHAP Analysis',
    desc:  'XGBoost + LightGBM trained automatically. SHAP-based driver ranking with no config required.',
  },
  {
    icon: BarChart3,
    color: 'var(--brand)',
    bg:    'var(--brand-dim)',
    border:'var(--border-brand)',
    title: 'Decision-Ready KPIs',
    desc:  'Monetized risk segments, counterfactuals, and concentration analysis — all in one report.',
  },
  {
    icon: Shield,
    color: 'var(--c-success)',
    bg:    'var(--c-success-bg)',
    border:'var(--c-success-border)',
    title: 'Governance & Audit',
    desc:  'Reliability scores, fairness flags, and full model lineage exported with every run.',
  },
]

export function Upload() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [name,         setName]         = useState('')
  const [loading,      setLoading]      = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [err,          setErr]          = useState<string | null>(null)
  const [drag,         setDrag]         = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const uploadFile = useCallback(
    async (file: File) => {
      setErr(null)
      setLoading(true)
      setSelectedFile(null)
      const fd = new FormData()
      fd.append('file', file)
      if (name.trim()) fd.append('name', name.trim())
      try {
        const { data } = await api.post('/datasets', fd)
        await qc.invalidateQueries({ queryKey: ['datasets'] })
        setLoading(false)
        setSuccess(true)
        setTimeout(() => navigate(`/datasets/${data.id}`), 1200)
      } catch (e: unknown) {
        setLoading(false)
        const detail =
          e && typeof e === 'object' && 'response' in e &&
          e.response && typeof e.response === 'object' && 'data' in e.response &&
          typeof (e.response as { data?: { detail?: string } }).data?.detail === 'string'
            ? (e.response as { data: { detail: string } }).data.detail
            : 'Upload failed.'
        setErr(detail)
      }
    },
    [name, navigate, qc],
  )

  const loadDemoData = useCallback(() => {
    setName('Demo: Telco Churn')
    const blob = new Blob([DEMO_CSV], { type: 'text/csv' })
    const file = new File([blob], 'demo_churn.csv', { type: 'text/csv' })
    setSelectedFile(file)
    void uploadFile(file)
  }, [uploadFile])

  useEffect(() => {
    if (searchParams.get('demo') === 'true') {
      setSearchParams({})
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDemoData()
    }
  }, [searchParams, setSearchParams, loadDemoData])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDrag(false)
      if (loading || success) return
      const f = e.dataTransfer.files[0]
      if (f) {
        setSelectedFile(f)
        void uploadFile(f)
      }
    },
    [loading, success, uploadFile],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) {
        setSelectedFile(f)
        void uploadFile(f)
      }
    },
    [uploadFile],
  )

  return (
    <div className="space-y-10 animate-fade-in-up">
      <PageHeader
        eyebrow="Step 1 of 3"
        title="Upload Dataset"
        description="Drag-and-drop or browse to upload a CSV or Parquet file. We'll profile the schema automatically."
        meta={
          <>
            <StatusBadge tone="info">.csv</StatusBadge>
            <StatusBadge tone="info">.parquet</StatusBadge>
            <StatusBadge tone="info">.xlsx</StatusBadge>
          </>
        }
      />

      {/* Top section: Name & Demo */}
      <div className="flex flex-col sm:flex-row gap-4 items-end animate-slide-in-left delay-100">
        <div className="flex-1 w-full max-w-sm">
          <Input
            label="Dataset name (optional)"
            placeholder="e.g. Customer Churn Q2 2025"
            value={name}
            onChange={e => setName(e.target.value)}
            hint="Defaults to filename if left blank"
          />
        </div>
        <div className="pb-6 text-(--text-3) hidden sm:block">or</div>
        <div className="pb-6">
          <Button type="button" variant="secondary" onClick={loadDemoData} disabled={loading || success}>
            <DatabaseZap className="h-4 w-4 text-(--brand)" />
            Try with demo data
          </Button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={e => { e.preventDefault(); setDrag(true) }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={[
          'relative flex flex-col items-center justify-center rounded-xl',
          'min-h-[280px] transition-all duration-(--duration-normal)',
          'border-2 border-dashed',
          drag
            ? 'border-(--brand) bg-(--brand-dim) scale-[1.01] shadow-(--shadow-glow)'
            : 'border-(--border-default) bg-(--surface-1) hover:border-(--border-brand) hover:bg-(--brand-dimmer)',
          'animate-fade-in-up delay-150',
        ].join(' ')}
      >
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[calc(var(--radius-xl)-2px)] transition-opacity duration-500"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 0%, hsl(214 100% 59% / 0.08) 0%, transparent 70%)',
            opacity: drag ? 1 : 0,
          }}
        />

        {loading && (
          <div className="relative z-10 flex flex-col items-center gap-5 animate-spring-in">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-2 border-(--border-subtle)" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-(--brand) animate-spin" />
            </div>
            <p className="text-sm font-semibold text-(--text-2) animate-pulse">Uploading and profiling…</p>
          </div>
        )}

        {success && (
          <div className="relative z-10 flex flex-col items-center gap-4 animate-spring-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--c-success-bg) border border-(--c-success-border)">
              <CheckCircle2 className="h-8 w-8 text-(--c-success)" />
            </div>
            <p className="text-sm font-semibold text-(--c-success)">Uploaded! Redirecting…</p>
          </div>
        )}

        {!loading && !success && (
          <label className="relative z-10 flex cursor-pointer flex-col items-center gap-5 p-8 text-center">
            <input
              type="file"
              accept=".csv,.parquet,.xlsx"
              className="sr-only"
              onChange={onChange}
            />

            <div className={[
              'flex h-16 w-16 items-center justify-center rounded-xl',
              'border border-(--border-brand) bg-(--brand-dim)',
              'text-(--brand) transition-transform',
              drag ? 'scale-110 animate-bounce' : 'animate-float',
            ].join(' ')}>
              <UploadCloud className="h-8 w-8" />
            </div>

            <div>
              <p className="text-lg font-bold text-(--text-1)">
                {drag ? 'Release to upload' : 'Drop your file here'}
              </p>
              <p className="mt-1.5 text-sm text-(--text-2)">
                or{' '}
                <span className="font-semibold text-(--brand) underline underline-offset-2 decoration-dashed">
                  browse files
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {['CSV', 'PARQUET', 'XLSX'].map(f => (
                <span key={f} className="flex items-center gap-1.5 rounded-full border border-(--border-default) bg-(--surface-2) px-2.5 py-1 text-[11px] font-semibold text-(--text-3)">
                  <FileType className="h-3 w-3" /> {f}
                </span>
              ))}
            </div>
          </label>
        )}
      </div>

      {/* File preview strip */}
      {selectedFile && loading && (
        <div className="flex items-center gap-4 rounded-lg border border-(--border-brand) bg-(--brand-dim) px-5 py-4 animate-spring-in">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-(--border-brand) bg-(--brand-dimmer)">
            <FileType className="h-5 w-5 text-(--brand)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-(--text-1) truncate">{selectedFile.name}</p>
            <p className="text-xs text-(--text-2) mt-0.5">
              {(selectedFile.size / 1024).toFixed(1)} KB
              {selectedFile.type && (
                <span className="ml-2 capitalize">{selectedFile.type.split('/').pop()?.toUpperCase()}</span>
              )}
            </p>
          </div>
          <span className="shrink-0 text-xs font-bold text-(--brand) animate-pulse">Uploading…</span>
        </div>
      )}

      {err && (
        <div className="flex items-start gap-3 rounded-lg border border-(--c-danger-border) bg-(--c-danger-bg) px-5 py-4 animate-spring-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-(--c-danger)" />
          <div>
            <p className="text-sm font-bold text-(--c-danger)">Upload failed</p>
            <p className="mt-0.5 text-xs text-(--text-2)">{err}</p>
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div>
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-(--text-3)">
          What happens after upload
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`flex gap-4 rounded-lg border p-4 transition-colors hover:border-(--border-default) animate-spring-up delay-${(i+2)*100}`}
              style={{ borderColor: f.border, background: f.bg }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
                style={{ borderColor: f.border, background: f.bg }}
              >
                <f.icon className="h-5 w-5" style={{ color: f.color }} />
              </div>
              <div>
                <p className="text-sm font-bold text-(--text-1)">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-(--text-2)">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="sm" to="/datasets">
          ← Back to datasets
        </Button>
      </div>
    </div>
  )
}
