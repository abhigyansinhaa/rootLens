import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Database, Upload, ChevronLeft, ChevronRight, LogOut, User as UserIcon } from 'lucide-react'

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
  userEmail: string
  onLogout: () => void
}

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/datasets', label: 'Datasets', icon: Database, end: false },
  { to: '/upload', label: 'Upload', icon: Upload, end: false },
]

export function Sidebar({ collapsed, onToggle, userEmail, onLogout }: SidebarProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-1)] transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-[var(--app-header-height)] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
        <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'w-8 justify-center' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-600 to-slate-900 text-white shadow-md shadow-brand-700/30 ring-1 ring-white/15">
            <span className="font-mono text-sm font-black">R</span>
          </div>
          {!collapsed && (
            <span className="whitespace-nowrap font-sans">
              <span className="font-black text-[var(--text-1)]">RCA</span>
              <span className="ml-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-3)]">Cockpit</span>
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-brand-50/50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-[var(--text-3)] group-hover:text-[var(--text-1)]'
                  }`}
                />
                {!collapsed && <span className="truncate animate-slide-in-left">{item.label}</span>}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-500 transition-all"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="border-t border-[var(--border-subtle)] p-3">
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="mb-2 flex w-full items-center justify-center rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>

        {/* User Pill */}
        <div className={`relative flex items-center rounded-xl bg-[var(--surface-2)] p-2 transition-all ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--border-2)] text-[var(--text-2)]">
            <UserIcon className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col justify-center animate-slide-in-left">
              <span className="truncate text-xs font-semibold text-[var(--text-1)]">
                {userEmail}
              </span>
              <span className="text-[10px] font-medium uppercase text-brand-500">
                Operator
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              className="ml-auto rounded-md p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-red-500 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
