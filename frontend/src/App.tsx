import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { AnalysisResult } from './features/analysis/AnalysisResult'
import { Dashboard } from './features/dashboard/Dashboard'
import { Datasets } from './features/datasets/DatasetsList'
import { DatasetDetail } from './features/datasets/DatasetDetail'
import { Login } from './features/auth/Login'
import { Register } from './features/auth/Register'
import { Upload } from './features/datasets/Upload'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/datasets"
                element={
                  <ProtectedRoute>
                    <Datasets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <Upload />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/datasets/:id"
                element={
                  <ProtectedRoute>
                    <DatasetDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analyses/:id"
                element={
                  <ProtectedRoute>
                    <AnalysisResult />
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
