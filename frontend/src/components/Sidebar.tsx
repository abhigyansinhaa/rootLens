import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Database, Upload, BarChart3,
  ChevronLeft, ChevronRight, LogOut, X,
} from 'lucide-react'

type User = { id: number; email: string; created_at: string }

type SidebarProps = {
  collapsed:       boolean
  onToggle:        () => void
  user:            User
  onLogout:        () => void
  isOpenOnMobile?: boolean
  onCloseMobile?:  () => void
}

const navItems = [
  { to: '/',         label: 'Overview',  icon: LayoutDashboard, end: true  },
  { to: '/datasets', label: 'Datasets',  icon: Database,        end: false },
  { to: '/upload',   label: 'Upload',    icon: Upload,          end: false },
  { to: '/analyses', label: 'Analyses',  icon: BarChart3,       end: false },
]

/** Derive display name from email: john.doe@co.com → John */
function displayName(email: string): string {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._-]/)[0] ?? local
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/** Derive initials for avatar */
function initials(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function Sidebar({
  collapsed, onToggle, user, onLogout,
  isOpenOnMobile, onCloseMobile,
}: SidebarProps) {
  const name = displayName(user.email)
  const abbr = initials(user.email)

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenOnMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col',
          'border-r border-(--border-subtle) bg-(--surface-1)',
          'transition-all duration-300 ease-(--ease-spring)',
          collapsed ? 'w-(--sidebar-collapsed-width)' : 'w-(--sidebar-width)',
          isOpenOnMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* ── Brand Header ── */}
        <div className="relative flex h-(--app-header-height) shrink-0 items-center justify-between border-b border-(--border-subtle) px-4">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
            <img src="/logo.png" alt="RootLens" className="h-7 w-auto object-contain" />
          </div>

          {/* Collapsed: just logo */}
          {collapsed && (
            <div className="flex w-full items-center justify-center">
              <img src="/logo.png" alt="RootLens" className="h-7 w-auto object-contain" />
            </div>
          )}

          {/* Mobile close */}
          {isOpenOnMobile && !collapsed && (
            <button
              onClick={onCloseMobile}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-(--text-3) hover:bg-(--surface-2) hover:text-(--text-1) transition-colors md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
          {/* Section label */}
          {!collapsed && (
            <p className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-(--text-4)">
              Workspace
            </p>
          )}

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'group relative flex items-center gap-3 rounded-md',
                  'px-3 py-2.5 text-sm font-medium',
                  'transition-all duration-(--duration-normal)',
                  isActive
                    ? [
                        'bg-(--brand-dim) text-(--brand)',
                        'shadow-[inset_0_0_0_1px_var(--border-brand)]',
                      ].join(' ')
                    : [
                        'text-(--text-2)',
                        'hover:bg-(--surface-2) hover:text-(--text-1)',
                      ].join(' '),
                  collapsed ? 'justify-center' : '',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active left glow bar */}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-(--brand)"
                    />
                  )}

                  <item.icon
                    className={[
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      isActive
                        ? 'text-(--brand)'
                        : 'text-(--text-3) group-hover:text-(--text-1)',
                    ].join(' ')}
                  />

                  {!collapsed && (
                    <span className="truncate animate-fade-in">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="border-t border-(--border-subtle) p-2.5 space-y-1">
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={onToggle}
            className="hidden md:flex w-full items-center justify-center rounded-md p-2 text-(--text-3) hover:bg-(--surface-2) hover:text-(--text-1) transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />
            }
          </button>

          {/* User profile pill */}
          <div
            className={[
              'flex items-center rounded-md bg-(--surface-2) p-2',
              'border border-(--border-subtle)',
              'transition-all duration-(--duration-normal)',
              collapsed ? 'justify-center' : 'gap-2.5',
            ].join(' ')}
          >
            {/* Avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--brand-dim) border border-(--border-brand) text-(--brand) text-[11px] font-bold">
              {abbr}
            </div>

            {!collapsed && (
              <>
                <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden animate-fade-in">
                  <span className="truncate text-sm font-semibold text-(--text-1)" title={user.email}>
                    {name}
                  </span>
                  <span className="truncate text-[10px] text-(--text-3)" title={user.email}>
                    {user.email}
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  className="ml-auto shrink-0 rounded-sm p-1.5 text-(--text-3) hover:bg-(--surface-3) hover:text-(--c-danger) transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
