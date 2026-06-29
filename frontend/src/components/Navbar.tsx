import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Database, Upload, BarChart3,
  Menu, X, LogOut,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { NotificationBell } from './NotificationBell'

type User = { id: number; email: string; created_at: string }

type NavbarProps = {
  user: User
  onLogout: () => void
}

const navItems = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard, end: true },
  { to: '/datasets', label: 'Datasets', icon: Database, end: false },
  { to: '/upload', label: 'Upload', icon: Upload, end: false },
  { to: '/analyses', label: 'Analyses', icon: BarChart3, end: false },
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

export function Navbar({ user, onLogout }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const name = displayName(user.email)
  const abbr = initials(user.email)

  // Close mobile menu on navigation
  useEffect(() => {
    if (mobileMenuOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMobileMenuOpen(false)
    }
  }, [location.pathname, mobileMenuOpen])

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-(--border-subtle) bg-(--app-bg)">
        <div className="mx-auto flex h-(--app-header-height) max-w-(--page-max-width) items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* ── Left: Logo & Desktop Navigation ── */}
          <div className="flex items-center gap-8">
            <Link to="/" className="group flex items-center gap-2.5 shrink-0">
              <img src="/logo.png" alt="RootLens" className="h-6 w-auto object-contain" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'group relative flex items-center gap-2 rounded-md',
                      'px-3 py-1.5 text-sm font-medium',
                      'transition-all duration-(--duration-normal)',
                      isActive
                        ? 'text-(--text-1) bg-(--surface-2)'
                        : 'text-(--text-2) hover:text-(--text-1) hover:bg-(--surface-2)/50'
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={['h-4 w-4 shrink-0 transition-colors', isActive ? 'text-(--brand)' : 'text-(--text-3) group-hover:text-(--text-1)'].join(' ')} />
                      <span>{item.label}</span>
                      {/* Active bottom border indicator */}
                      {isActive && (
                        <span aria-hidden className="absolute -bottom-[19px] left-0 right-0 h-[2px] bg-(--brand) rounded-t-full" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* ── Right: Utilities & Profile ── */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 border-r border-(--border-subtle) pr-4 mr-2">
              <button
                className="hidden lg:flex items-center gap-1.5 mr-2 rounded-md border border-(--border-subtle) bg-(--surface-1) px-2 py-1 text-xs font-medium text-(--text-3) hover:bg-(--surface-2) hover:text-(--text-2) transition-colors"
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                title="Open Command Palette"
              >
                Search... <kbd className="ml-1 rounded bg-(--surface-3) px-1.5 py-0.5 text-[10px] font-sans font-semibold">⌘K</kbd>
              </button>
              <ThemeToggle />
              <NotificationBell />
            </div>

            {/* Desktop User Profile */}
            <div className="hidden md:flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-(--text-1) leading-none">{name}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-(--brand-dim) border border-(--border-focus) text-(--brand) text-xs font-bold hover:bg-(--brand) hover:text-white transition-colors"
                title="Sign out"
              >
                {abbr}
              </button>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden rounded-md p-2 text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1) transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Menu Overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out panel */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-(--surface-1) pt-5 pb-4 border-r border-(--border-subtle) animate-slide-in-right">
            <div className="absolute right-0 top-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>

            <div className="flex shrink-0 items-center px-4 mb-6">
              <img src="/logo.png" alt="RootLens" className="h-7 w-auto object-contain" />
            </div>

            <nav className="mt-5 h-full shrink-0 divide-y divide-(--border-subtle) overflow-y-auto" aria-label="Sidebar">
              <div className="px-2 space-y-1 pb-4">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'group flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium',
                        isActive
                          ? 'bg-(--brand-dim) text-(--brand) shadow-[inset_4px_0_0_0_var(--brand)]'
                          : 'text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1)'
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={['h-5 w-5 shrink-0', isActive ? 'text-(--brand)' : 'text-(--text-3)'].join(' ')} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 pt-4 px-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--brand-dim) border border-(--border-focus) text-(--brand) text-sm font-bold">
                    {abbr}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-(--text-1)">{name}</span>
                    <span className="text-xs text-(--text-3)">{user.email}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 px-1">
                  <span className="text-sm text-(--text-2)">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between mb-6 px-1">
                  <span className="text-sm text-(--text-2)">Notifications</span>
                  <NotificationBell />
                </div>

                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-(--critical) hover:bg-(--critical-bg)"
                >
                  <LogOut className="h-5 w-5" />
                  Sign out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
