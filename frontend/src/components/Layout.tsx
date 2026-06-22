import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Sidebar } from './Sidebar'
import { Breadcrumbs } from './Breadcrumbs'
import { ToastProvider } from './ui'
import { Menu } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'

/** Derive initials from an email address for the avatar */
function emailInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('rca:sidebar_collapsed')
    return saved === 'true'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('rca:sidebar_collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed])

  // Close mobile menu on navigation
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-header-height', '60px')
  }, [])

  // Dynamic page title
  useEffect(() => {
    const titles: Record<string, string> = {
      '/':              'Dashboard',
      '/datasets':      'Datasets',
      '/upload':        'Upload Dataset',
      '/analyses':      'All Analyses',
      '/analyses/compare': 'Compare Analyses',
    }
    const match = Object.entries(titles).find(([path]) =>
      path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
    )
    document.title = match ? `${match[1]} — RootLens` : 'RootLens'
  }, [location.pathname])

  /* ── Unauthenticated Layout (Auth Pages) ── */
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-(--app-bg)">
        <header className="sticky top-0 z-50 border-b border-(--border-subtle) glass">
          <div className="mx-auto flex h-(--app-header-height) max-w-7xl items-center justify-between px-4 lg:px-8">
            <Link to="/login" className="group flex items-center gap-2.5">
              <img src="/logo.png" alt="RootLens" className="h-7 w-auto object-contain" />
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                className="rounded-md px-3.5 py-1.5 text-sm font-medium text-(--text-2) transition-colors hover:bg-(--surface-2) hover:text-(--text-1)"
                to="/login"
              >
                Sign in
              </Link>
              <Link
                className="rounded-md bg-(--brand) px-4 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-[0_0_20px_hsl(214_100%_59%/0.4)]"
                to="/register"
              >
                Get started
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    )
  }

  const initials = emailInitials(user.email)

  /* ── Authenticated Cockpit Layout ── */
  return (
    <ToastProvider>
    <div className="flex min-h-screen bg-(--app-bg)">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
        onLogout={logout}
        isOpenOnMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed
            ? 'md:ml-(--sidebar-collapsed-width)'
            : 'md:ml-(--sidebar-width)'
        }`}
      >
        {/* ── Top Header ── */}
        <header className="sticky top-0 z-30 flex h-(--app-header-height) items-center justify-between border-b border-(--border-subtle) glass px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden -ml-1 rounded-md p-2 text-(--text-2) hover:bg-(--surface-2) hover:text-(--text-1) transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />

            {/* User avatar */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-(--brand-dim) border border-(--border-brand) text-(--brand) text-xs font-bold cursor-default select-none"
              title={user.email}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main id="main-content" className="flex-1 overflow-hidden">
          <div
            className="mx-auto max-w-(--page-max-width) px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in-up"
            key={location.pathname}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </ToastProvider>
  )
}
