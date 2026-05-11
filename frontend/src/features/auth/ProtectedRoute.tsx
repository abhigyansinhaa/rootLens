import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Card, Spinner } from '../../components/ui'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16" role="status" aria-busy="true">
        <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
          <Spinner className="h-10 w-10" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Loading your session</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">One moment…</p>
          </div>
        </Card>
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />
  }

  return <>{children}</>
}
