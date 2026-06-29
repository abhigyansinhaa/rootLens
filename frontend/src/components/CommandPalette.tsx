import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutDashboard, Database, Upload, BarChart3, Sun, Moon, Plus, Download, History, Shield } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

type CommandItem = {
  id: string
  title: string
  icon: any
  type: string
  shortcut?: string
  action: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  // Toggle palette with Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (query !== '') {
      setQuery('')
    }
  }, [open, query])

  const items: CommandItem[] = [
    { id: 'home', title: 'Open Command Center', icon: LayoutDashboard, type: 'Navigation', shortcut: '⌘1', action: () => navigate('/') },
    { id: 'datasets', title: 'View Datasets', icon: Database, type: 'Navigation', shortcut: '⌘2', action: () => navigate('/datasets') },
    { id: 'upload', title: 'Upload Dataset', icon: Upload, type: 'Navigation', shortcut: '⌘3', action: () => navigate('/upload') },
    { id: 'analyses', title: 'View Analyses', icon: BarChart3, type: 'Navigation', shortcut: '⌘4', action: () => navigate('/analyses') },
    { id: 'new', title: 'Create New Analysis', icon: Plus, type: 'Actions', shortcut: '⌘N', action: () => { navigate('/upload'); setOpen(false) } },
    { id: 'export', title: 'Export Report', icon: Download, type: 'Actions', shortcut: '⌘E', action: () => { setOpen(false) } },
    { id: 'history', title: 'View History', icon: History, type: 'Actions', shortcut: '⌘H', action: () => { navigate('/analyses'); setOpen(false) } },
    { id: 'governance', title: 'Open Governance', icon: Shield, type: 'Actions', shortcut: '⌘G', action: () => { setOpen(false) } },
    { id: 'theme', title: `Toggle ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, icon: theme === 'dark' ? Sun : Moon, type: 'Appearance', shortcut: '⌘D', action: () => { toggle(); setOpen(false) } },
  ]

  // Global shortcuts
  useEffect(() => {
    if (open) return // Don't trigger global shortcuts if palette is open

    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const item = items.find(i => i.shortcut?.toLowerCase() === `⌘${e.key.toLowerCase()}`)
        if (item) {
          e.preventDefault()
          item.action()
        }
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, theme, navigate, toggle])


  if (!open) return null

  const filteredItems = query === ''
    ? items
    : items.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.type.toLowerCase().includes(query.toLowerCase())
    )

  const handleSelect = (item: CommandItem) => {
    item.action()
    setOpen(false)
  }

  // Group items by type
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  }, {} as Record<string, CommandItem[]>)

  // We want to flatten for keyboard navigation
  const flatGroupedItems = Object.values(groupedItems).flat()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-(--border-strong) bg-(--surface-1) shadow-2xl ring-1 ring-white/5 animate-fade-in-up"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center border-b border-(--border-subtle) px-4">
          <Search className="h-5 w-5 text-(--text-3)" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent px-4 py-4 text-base text-(--text-1) placeholder:text-(--text-3) focus:outline-none"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter' && flatGroupedItems.length > 0) {
                handleSelect(flatGroupedItems[0])
              }
            }}
          />
          <kbd className="hidden sm:inline-block rounded border border-(--border-subtle) bg-(--surface-2) px-2 py-0.5 text-xs font-medium text-(--text-3)">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {flatGroupedItems.length === 0 ? (
            <p className="p-4 text-center text-sm text-(--text-3)">No results found.</p>
          ) : (
            <div className="space-y-4 py-2">
              {Object.entries(groupedItems).map(([type, groupItems]) => (
                <div key={type} className="space-y-1">
                  <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-(--text-4)">
                    {type}
                  </div>
                  {groupItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-(--surface-2) text-(--text-2) hover:text-(--text-1)`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0 opacity-70 group-hover:text-(--brand) group-hover:opacity-100" />
                        <span>{item.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.shortcut && (
                          <kbd className="rounded bg-(--surface-2) group-hover:bg-(--surface-3) px-1.5 py-0.5 text-[10px] font-sans font-semibold text-(--text-3) transition-colors">
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
