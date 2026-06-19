import { createPortal } from 'react-dom'
import { X, Download, Printer, FileJson, FileSpreadsheet, Share2, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

interface ExportHubProps {
  open: boolean
  onClose: () => void
  analysisId: number
  onDownloadCsv: () => void
  onDownloadJson: () => void
  onPrint: () => void
  canExport: boolean
}

export function ExportHub({
  open,
  onClose,
  analysisId,
  onDownloadCsv,
  onDownloadJson,
  onPrint,
  canExport,
}: ExportHubProps) {
  const [copied, setCopied] = useState(false)

  const copyShareLink = () => {
    const url = `${window.location.origin}/analyses/${analysisId}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!open) return null

  const actions = [
    {
      id: 'csv',
      icon: FileSpreadsheet,
      label: 'Download CSV',
      desc: 'KPI summary as a spreadsheet-ready CSV',
      color: 'var(--c-success)',
      bg: 'var(--c-success-bg)',
      border: 'var(--c-success-border)',
      onClick: () => { onDownloadCsv(); onClose() },
      disabled: !canExport,
    },
    {
      id: 'json',
      icon: FileJson,
      label: 'Download JSON',
      desc: 'Full analysis artifact with all raw data',
      color: 'var(--brand)',
      bg: 'var(--brand-dim)',
      border: 'var(--border-brand)',
      onClick: () => { onDownloadJson(); onClose() },
      disabled: !canExport,
    },
    {
      id: 'print',
      icon: Printer,
      label: 'Print / Save PDF',
      desc: 'Browser print dialog — save as PDF for sharing',
      color: 'var(--c-info)',
      bg: 'var(--c-info-bg)',
      border: 'var(--c-info-border)',
      onClick: () => { onPrint(); onClose() },
      disabled: !canExport,
    },
    {
      id: 'share',
      icon: copied ? CheckCircle2 : Share2,
      label: copied ? 'Link copied!' : 'Copy share link',
      desc: 'Shareable URL — preserves the current tab via ?tab= parameter',
      color: copied ? 'var(--c-success)' : 'var(--c-warning)',
      bg: copied ? 'var(--c-success-bg)' : 'var(--c-warning-bg)',
      border: copied ? 'var(--c-success-border)' : 'var(--c-warning-border)',
      onClick: copyShareLink,
      disabled: false,
    },
  ]

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export options"
        className={[
          'fixed left-1/2 top-1/2 z-[10001] -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-md',
          'rounded-[var(--radius-xl)] border border-[var(--border-default)]',
          'bg-[var(--surface-2)] shadow-[var(--shadow-2xl)]',
          'overflow-hidden animate-spring-up',
        ].join(' ')}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-dim)] border border-[var(--border-brand)]">
            <Download className="h-4 w-4 text-[var(--brand)]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">Export Hub</p>
            <p className="text-sm font-bold text-[var(--text-1)]">Analysis #{analysisId}</p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Close export hub"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {actions.map(({ id, icon: Icon, label, desc, color, bg, border, onClick, disabled }) => (
            <button
              key={id}
              type="button"
              onClick={onClick}
              disabled={disabled}
              className={[
                'w-full flex items-center gap-4 rounded-[var(--radius-lg)] border p-4',
                'text-left transition-all duration-[var(--duration-normal)]',
                disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:-translate-y-px hover:shadow-[var(--shadow-md)] cursor-pointer',
              ].join(' ')}
              style={{ borderColor: border, background: bg }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border"
                style={{ borderColor: border, background: bg }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color }}>{label}</p>
                <p className="text-xs text-[var(--text-3)] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {!canExport && (
          <div className="px-4 pb-4">
            <p className="text-xs text-center text-[var(--text-3)]">
              Export is available once the analysis completes.
            </p>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
