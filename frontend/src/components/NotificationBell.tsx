/**
 * NotificationBell — polls for recently-completed analyses.
 * Shows an unread count badge and a dropdown of recent completions.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, X, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AnalysisListItem } from '../types'

const STORAGE_KEY = 'rootLens:notif_last_seen'
const POLL_INTERVAL = 30_000  // 30s

function getLastSeen(): number {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10) || 0 } catch { return 0 }
}
function saveLastSeen(ts: number) {
  try { localStorage.setItem(STORAGE_KEY, String(ts)) } catch { /* */ }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(getLastSeen)
  const panelRef = useRef<HTMLDivElement>(null)

  // Poll only when tab is visible
  const [tabVisible, setTabVisible] = useState(!document.hidden)
  useEffect(() => {
    const handler = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  const { data } = useQuery({
    queryKey: ['notif-analyses'],
    queryFn: async () => {
      const { data } = await api.get<AnalysisListItem[]>('/analyses', { params: { limit: 20 } })
      return data
    },
    refetchInterval: tabVisible ? POLL_INTERVAL : false,
    staleTime: 20_000,
  })

  const completed = (data ?? []).filter(a =>
    (a.status === 'completed' || a.status === 'completed_with_warnings') &&
    a.completed_at &&
    new Date(a.completed_at).getTime() > lastSeen
  )

  const unreadCount = completed.length

  const markAllRead = useCallback(() => {
    const now = Date.now()
    saveLastSeen(now)
    setLastSeen(now)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open && unreadCount > 0) {
      markAllRead()
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative rounded-md p-2 text-(--text-3) hover:bg-(--surface-2) hover:text-(--text-1) transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--critical) text-[9px] font-black text-white shadow-(--shadow-sm) animate-spring-up"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={[
            'absolute right-0 top-full mt-2 z-200',
            'w-80 rounded-xl border border-(--border-default)',
            'bg-(--surface-2) shadow-(--shadow-2xl)',
            'overflow-hidden animate-spring-up',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-(--border-subtle) px-4 py-3 bg-(--surface-1)">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-(--brand)" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--text-2)">
                Recent Completions
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount === 0 && completed.length === 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-semibold text-(--brand) hover:underline mr-1"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-(--text-3) hover:text-(--text-1) transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-(--border-subtle)">
            {(data ?? [])
              .filter(a => a.status === 'completed' || a.status === 'completed_with_warnings')
              .slice(0, 8)
              .map(run => {
                const isNew = run.completed_at && new Date(run.completed_at).getTime() > lastSeen - 1
                return (
                  <Link
                    key={run.id}
                    to={`/analyses/${run.id}`}
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-(--surface-3) transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-(--success)" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-(--text-1) truncate">
                        {run.dataset_name}
                        {isNew && (
                          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-(--brand) align-middle" aria-label="New" />
                        )}
                      </p>
                      <p className="text-[10px] text-(--text-3) mt-0.5">
                        target: <span className="text-(--brand)">{run.target}</span>
                        {run.completed_at && ` · ${timeAgo(run.completed_at)}`}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-(--text-4) group-hover:text-(--brand) transition-colors" />
                  </Link>
                )
              })
            }
            {(data ?? []).filter(a => a.status === 'completed' || a.status === 'completed_with_warnings').length === 0 && (
              <div className="py-10 text-center text-xs text-(--text-3)">
                No completed analyses yet.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-(--border-subtle) px-4 py-2.5 bg-(--surface-1)">
            <Link
              to="/analyses"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-(--brand) hover:underline"
            >
              View all analyses →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
