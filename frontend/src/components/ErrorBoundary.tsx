/**
 * ErrorBoundary — per-route friendly fallback.
 * Catches render errors in child component trees.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-[var(--radius-xl)] border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)] p-10 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--c-danger-border)] bg-[var(--c-danger-bg)]">
            <AlertOctagon className="h-7 w-7 text-[var(--c-danger)]" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--c-danger)] mb-1">
              {this.props.label ?? 'Something went wrong'}
            </p>
            <p className="text-base font-bold text-[var(--text-1)] mb-2">
              This section failed to render
            </p>
            {this.state.error && (
              <p className="max-w-md text-xs font-mono text-[var(--text-3)] break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors shadow-[var(--shadow-sm)]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
