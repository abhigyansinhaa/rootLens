import { Outlet, useParams, useLocation, Link } from 'react-router-dom'
import { Datasets } from './DatasetsList'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Suspense } from 'react'
import { DatasetDetailSkeleton } from '../../components/PageSkeletons'
import { ArrowLeft } from 'lucide-react'

export function DatasetsLayout() {
  const { id } = useParams()
  const location = useLocation()

  const isDetailView = !!id

  return (
    <div className={`flex w-full transition-all duration-300 ${isDetailView ? 'flex-col lg:flex-row gap-6 min-h-125 lg:h-[calc(100vh-var(--app-header-height)-90px)] lg:overflow-hidden' : 'flex-col'}`}>
      
      {/* ── Mobile Back Link ── */}
      {isDetailView && (
        <div className="lg:hidden pb-2">
          <Link
            to="/datasets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--brand) hover:text-(--text-1) transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to all datasets
          </Link>
        </div>
      )}

      {/* ── Left Pane (Master List) ── */}
      <div 
        className={`transition-all duration-300 ease-(--ease-spring) flex flex-col ${
          isDetailView 
            ? 'w-80 shrink-0 border-r border-(--border-subtle) pr-6 hidden lg:flex' 
            : 'w-full flex-1'
        }`}
      >
        <div className={isDetailView ? "h-full overflow-y-auto pr-2 custom-scrollbar" : ""}>
          <Datasets compact={isDetailView} />
        </div>
      </div>

      {/* ── Right Pane (Detail View) ── */}
      {isDetailView && (
        <div className="flex-1 overflow-y-auto rounded-xl border border-(--border-subtle) bg-(--surface-1) shadow-xl relative animate-fade-in-up custom-scrollbar">
           <ErrorBoundary label="Dataset detail error">
             <Suspense fallback={<DatasetDetailSkeleton />}>
               <Outlet key={location.pathname} />
             </Suspense>
           </ErrorBoundary>
        </div>
      )}
    </div>
  )
}
