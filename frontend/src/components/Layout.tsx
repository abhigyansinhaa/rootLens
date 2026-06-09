import { useState, useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Sidebar } from './Sidebar'
import { Breadcrumbs } from './Breadcrumbs'
import { Menu } from 'lucide-react'

export function Layout() {
  const { user, logout } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('rca:sidebar_collapsed')
    return saved === 'true'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('rca:sidebar_collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed])

  // Update header height variable (used by sticky elements)
  useEffect(() => {
    document.documentElement.style.setProperty('--app-header-height', '64px')
  }, [])

  if (!user) {
    // Unauthenticated Layout (Auth Pages)
    return (
      <div className="flex min-h-screen flex-col bg-[var(--app-bg)]">
        <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--app-bg)]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[var(--app-header-height)] max-w-7xl items-center justify-between px-4 lg:px-8">
            <Link to="/login" className="group flex items-center gap-2.5 text-base font-bold tracking-tight text-[var(--text-1)]">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--text-1)] ring-1 ring-[var(--border-strong)]">
                <span className="font-mono text-sm font-black">R</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-sans font-bold">rootLens</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-3)]">Cockpit</span>
              </span>
            </Link>
            <nav className="flex items-center gap-3">
              <Link className="rounded-md px-3 py-1.5 text-sm font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]" to="/login">
                Log in
              </Link>
              <Link className="rounded-md bg-white px-4 py-1.5 text-sm font-bold text-black transition-colors hover:bg-gray-200" to="/register">
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

  // Authenticated Layout (Cockpit)
  return (
    <div className="flex min-h-screen bg-[var(--app-bg)]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userEmail={user.email}
        onLogout={logout}
        isOpenOnMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      
      <div 
        className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[256px]'}`}
      >
        {/* Top Toolbar */}
        <header className="sticky top-0 z-30 flex h-[var(--app-header-height)] items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--app-bg)]/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden -ml-2 rounded-md p-2 text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            {/* Future top toolbar actions can go here */}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in-up">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* Inline Footer */}
        <footer className="mt-auto border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/50 py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 text-[11px] font-medium text-[var(--text-3)] sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <span>Root-cause analysis with interpretable ML</span>
            <span className="flex flex-wrap items-center justify-center gap-3">
              <span>CSV / Parquet</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--border-2)]" />
              <span>SHAP-driven explainability</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--border-2)]" />
              <span>Audit-ready reporting</span>
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
