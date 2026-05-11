import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useAuth } from './AuthContext'
import { Button, Card, Input, StatusBadge } from '../../components/ui'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await register(email, password)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof AxiosError) {
        const detail = error.response?.data?.detail
        if (typeof detail === 'string' && detail.length > 0) {
          setErr(detail)
        } else if (!error.response) {
          setErr('Cannot reach backend. Make sure the API server is running.')
        } else {
          setErr('Could not register. Please try again.')
        }
      } else {
        setErr('Could not register. Please try again.')
      }
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
          Spin up a workspace in minutes
        </h1>
        <p className="max-w-lg text-sm leading-7 text-[var(--text-2)]">
          Create a workspace for uploads, model explainability, KPI rollups, and recommended interventions.
        </p>
        <ul className="grid max-w-md gap-3 text-sm">
          {[
            { tone: 'info' as const, label: 'Step 1', body: 'Upload a CSV or Parquet table.' },
            { tone: 'info' as const, label: 'Step 2', body: 'Pick a target column - we infer task type.' },
            { tone: 'success' as const, label: 'Step 3', body: 'Read explainable KPIs and recommended actions.' },
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
          New account
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-[var(--text-1)]">Create your workspace</h2>
        <p className="mt-1 text-sm text-[var(--text-2)]">Just an email and password to get going.</p>
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
            hint="At least 8 characters"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && (
            <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--text-2)]">
          Already have an account?{' '}
          <Link className="font-bold text-brand-600 hover:underline dark:text-brand-300" to="/login">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  )
}
