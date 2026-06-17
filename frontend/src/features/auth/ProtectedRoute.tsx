import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { LoadingState } from '../../components/ui'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState fullPage message="Loading session…" />
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />
  }

  return <>{children}</>
}
