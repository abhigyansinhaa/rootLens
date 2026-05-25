import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export function Breadcrumbs() {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter((x) => x)

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1 sm:space-x-2">
      <Link
        to="/"
        className="flex items-center text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1
        const to = `/${pathnames.slice(0, index + 1).join('/')}`
        
        // Capitalize and format value
        const formattedValue = value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ')

        return (
          <div key={to} className="flex items-center">
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--border-strong)]" />
            <Link
              to={last ? '#' : to}
              className={`ml-1 sm:ml-2 text-sm font-medium ${
                last
                  ? 'text-[var(--text-1)] pointer-events-none'
                  : 'text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors'
              }`}
              aria-current={last ? 'page' : undefined}
            >
              {formattedValue}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
