import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import {
  AnalysesListSkeleton,
  AnalysisResultSkeleton,
  AuthSkeleton,
  CompareAnalysesSkeleton,
  DashboardSkeleton,
  UploadSkeleton,
} from './components/PageSkeletons'

const DatasetsLayoutSkeleton = () => (
  <div className="flex w-full h-[calc(100vh-60px)] gap-6">
    <div className="w-80 shrink-0 border-r border-(--border-subtle) pr-6 hidden lg:flex flex-col gap-4">
      <div className="h-8 w-1/3 rounded bg-(--surface-2) animate-pulse" />
      <div className="flex-1 rounded-xl bg-(--surface-2) animate-pulse" />
    </div>
    <div className="flex-1 rounded-xl bg-(--surface-2) animate-pulse" />
  </div>
)

/* ─── Lazy-loaded page components ──────────────────────────────────────────
   Each import() creates a separate JS chunk that is only fetched when the
   user first navigates to that route. The Suspense fallback shows the
   content-shaped skeleton while the chunk is being downloaded + parsed.
   ─────────────────────────────────────────────────────────────────────── */
const Dashboard       = lazy(() => import('./features/dashboard/Dashboard').then(m => ({ default: m.Dashboard })))
const DatasetsLayout  = lazy(() => import('./features/datasets/DatasetsLayout').then(m => ({ default: m.DatasetsLayout })))
const DatasetDetail   = lazy(() => import('./features/datasets/DatasetDetail').then(m => ({ default: m.DatasetDetail })))
const Upload          = lazy(() => import('./features/datasets/Upload').then(m => ({ default: m.Upload })))
const AnalysesList    = lazy(() => import('./features/analysis/AnalysesList').then(m => ({ default: m.AnalysesList })))
const AnalysisResult  = lazy(() => import('./features/analysis/AnalysisResult').then(m => ({ default: m.AnalysisResult })))
const CompareAnalyses = lazy(() => import('./features/analysis/CompareAnalyses').then(m => ({ default: m.CompareAnalyses })))
const Login           = lazy(() => import('./features/auth/Login').then(m => ({ default: m.Login })))
const Register        = lazy(() => import('./features/auth/Register').then(m => ({ default: m.Register })))

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {/* Skip to main content — keyboard / screen reader accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-99999 focus:rounded-lg focus:border focus:border-(--border-brand) focus:bg-(--surface-2) focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-(--brand) focus:shadow-(--shadow-lg)"
          >
            Skip to main content
          </a>
          <Routes>
            <Route element={<Layout />}>
              {/* ── Auth routes ── */}
              <Route
                path="/login"
                element={
                  <Suspense fallback={<AuthSkeleton />}>
                    <Login />
                  </Suspense>
                }
              />
              <Route
                path="/register"
                element={
                  <Suspense fallback={<AuthSkeleton />}>
                    <Register />
                  </Suspense>
                }
              />

              {/* ── Protected routes ── */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary label="Dashboard error">
                      <Suspense fallback={<DashboardSkeleton />}>
                        <Dashboard />
                      </Suspense>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/datasets"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary label="Datasets error">
                      <Suspense fallback={<DatasetsLayoutSkeleton />}>
                        <DatasetsLayout />
                      </Suspense>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              >
                <Route index element={null} />
                <Route path=":id" element={<DatasetDetail />} />
              </Route>
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary label="Upload error">
                      <Suspense fallback={<UploadSkeleton />}>
                        <Upload />
                      </Suspense>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analyses"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary label="Analyses list error">
                      <Suspense fallback={<AnalysesListSkeleton />}>
                        <AnalysesList />
                      </Suspense>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analyses/compare"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary label="Comparison error">
                      <Suspense fallback={<CompareAnalysesSkeleton />}>
                        <CompareAnalyses />
                      </Suspense>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analyses/:id"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary label="Analysis result error">
                      <Suspense fallback={<AnalysisResultSkeleton />}>
                        <AnalysisResult />
                      </Suspense>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
