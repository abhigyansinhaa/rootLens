import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/', label: 'Overview', end: true },
  { to: '/datasets', label: 'Datasets', end: false },
  { to: '/upload', label: 'Upload', end: false },
] as const

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-all',
    isActive
      ? 'text-[var(--text-1)]'
      : 'text-[var(--text-3)] hover:text-[var(--text-1)]',
  ].join(' ')

const ActiveIndicator = ({ isActive }: { isActive: boolean }) =>
  isActive ? (
    <span
      aria-hidden
      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500"
    />
  ) : null

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-[var(--border-1)] bg-[var(--app-bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link
              to={user ? '/' : '/login'}
              className="group flex items-center gap-2.5 text-base font-bold tracking-tight text-[var(--text-1)]"
            >
              <span
                aria-hidden
                className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-slate-900 text-white shadow-md shadow-brand-700/30 ring-1 ring-white/15"
              >
                <span className="font-mono text-sm font-black">R</span>
                <span className="absolute inset-x-0 bottom-0 h-px bg-white/40" />
              </span>
              <span className="hidden sm:flex sm:items-baseline sm:gap-1.5">
                <span className="font-black">RCA</span>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-3)]">Cockpit</span>
              </span>
            </Link>

            {user && (
              <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
                {navItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        {item.label}
                        <ActiveIndicator isActive={isActive} />
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <nav className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <span className="hidden items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] md:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  <span className="max-w-[180px] truncate">{user.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                  to="/login"
                >
                  Log in
                </Link>
                <Link
                  className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-bold text-white shadow-md shadow-brand-700/25 transition-colors hover:bg-brand-400"
                  to="/register"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>

        {user && (
          <div className="flex gap-1 overflow-x-auto border-t border-[var(--border-1)] px-4 py-2 sm:hidden">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    {item.label}
                    <ActiveIndicator isActive={isActive} />
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10 lg:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border-1)] py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 text-[11px] font-medium text-[var(--text-3)] sm:flex-row sm:justify-between sm:px-6">
          <span>Root-cause analysis with interpretable ML</span>
          <span className="flex items-center gap-3">
            <span>CSV / Parquet</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--border-2)]" />
            <span>SHAP-driven explainability</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--border-2)]" />
            <span>Audit-ready reporting</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
