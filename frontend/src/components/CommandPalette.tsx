import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutDashboard, Database, Upload, BarChart3, Sun, Moon, ArrowRight } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
    }
  }, [open, query])

  if (!open) return null

  const items = [
    { id: 'home', title: 'Go to Overview', icon: LayoutDashboard, type: 'Navigation', action: () => navigate('/') },
    { id: 'datasets', title: 'View Datasets', icon: Database, type: 'Navigation', action: () => navigate('/datasets') },
    { id: 'upload', title: 'Upload Dataset', icon: Upload, type: 'Navigation', action: () => navigate('/upload') },
    { id: 'analyses', title: 'View Analyses', icon: BarChart3, type: 'Navigation', action: () => navigate('/analyses') },
    { id: 'theme', title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`, icon: theme === 'dark' ? Sun : Moon, type: 'Appearance', action: () => toggle() },
  ]

  const filteredItems = query === ''
    ? items
    : items.filter((item) =>
      item.title.toLowerootLensse().includes(query.toLowerootLensse()) ||
      item.type.toLowerootLensse().includes(query.toLowerootLensse())
    )

  const handleSelect = (item: typeof items[0]) => {
    item.action()
    setOpen(false)
  }

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
              if (e.key === 'Enter' && filteredItems.length > 0) {
                handleSelect(filteredItems[0])
              }
            }}
          />
          <kbd className="hidden sm:inline-block rounded border border-(--border-subtle) bg-(--surface-2) px-2 py-0.5 text-xs font-medium text-(--text-3)">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="p-4 text-center text-sm text-(--text-3)">No results found.</p>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-(--brand-dim) hover:text-(--brand) ${index === 0 && query !== '' ? 'bg-(--brand-dim) text-(--brand)' : 'text-(--text-2)'}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                    <span>{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-(--text-3) opacity-0 transition-opacity group-hover:opacity-100">{item.type}</span>
                    <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
