import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button, Card, Input, StatusBadge } from '../../components/ui'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch {
      setErr('Invalid email or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.05fr_420px] lg:items-center">
      <div className="space-y-6">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-600 dark:text-brand-300">
          RCA Cockpit
        </p>
        <h1 className="text-4xl font-black tracking-tight text-[var(--text-1)] sm:text-5xl">
          Welcome back to the command room
        </h1>
        <p className="max-w-lg text-sm leading-7 text-[var(--text-2)]">
          Sign in to upload datasets, monitor model runs, and review decision-ready root-cause insights.
        </p>
        <ul className="grid max-w-md gap-3 text-sm">
          {[
            { tone: 'success' as const, label: 'Audit-ready', body: 'Every run keeps metrics, drivers, and SHAP evidence.' },
            { tone: 'info' as const, label: 'Explainable', body: 'Insights tie business KPIs to underlying model drivers.' },
            { tone: 'warning' as const, label: 'Actionable', body: 'Recommendations focus the operator on next moves.' },
          ].map((item) => (
            <li
              key={item.label}
              className="flex items-start gap-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-2)] p-3"
            >
              <StatusBadge tone={item.tone} dot>
                {item.label}
              </StatusBadge>
              <span className="text-[var(--text-2)]">{item.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <Card padding="lg" tone="strong" elevated>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-600 dark:text-brand-300">
          Sign in
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[var(--text-1)]">Operator login</h2>
        <p className="mt-1 text-sm text-[var(--text-2)]">Use your workspace email and password.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && (
            <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--text-2)]">
          No account?{' '}
          <Link className="font-bold text-brand-600 hover:underline dark:text-brand-300" to="/register">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  )
}
