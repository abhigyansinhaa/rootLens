import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Navbar } from './Navbar'
import { Breadcrumbs } from './Breadcrumbs'
import { CommandPalette } from './CommandPalette'
import { ToastProvider } from './ui'



export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  useEffect(() => {
    document.documentElement.style.setProperty('--app-header-height', '60px')
  }, [])

  // Dynamic page title
  useEffect(() => {
    const titles: Record<string, string> = {
      '/':              'Command Center',
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
        <header className="sticky top-0 z-50 border-b border-(--border-subtle) bg-(--app-bg)">
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
                className="rounded-md bg-(--brand) px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110 shadow-sm"
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



  /* ── Authenticated Cockpit Layout ── */
  return (
    <ToastProvider>
    <div className="flex min-h-screen flex-col bg-(--app-bg)">
      {/* ── Top Navbar ── */}
      <Navbar user={user} onLogout={logout} />

      {/* ── Breadcrumbs ── */}
      <div className="mx-auto w-full max-w-(--page-max-width) px-4 sm:px-6 lg:px-8 py-3">
        <Breadcrumbs />
      </div>

      {/* ── Main Content ── */}
      <main id="main-content" className="flex-1 overflow-x-hidden">
        <div
          className="mx-auto max-w-(--page-max-width) px-4 sm:px-6 lg:px-8 pb-12 animate-fade-in-up"
          key={location.pathname}
        >
          <Outlet />
        </div>
      </main>

      {/* ── Global Utilities ── */}
      <CommandPalette />
    </div>
    </ToastProvider>
  )
}
