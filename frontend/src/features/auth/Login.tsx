import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Button, Input } from '../../components/ui'
import { ShieldCheck, Server, Lock, Eye, EyeOff, Activity } from 'lucide-react'

export function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)

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
    <div className="flex min-h-screen bg-(--app-bg)">
      {/* ── Left Panel: Enterprise Value Props ── */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-(--border-subtle) bg-(--surface-1) p-12 lg:flex xl:p-20">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--brand-dim) border border-(--border-brand)">
               <Activity className="h-5 w-5 text-(--brand)" />
            </div>
            <span className="text-xl font-bold tracking-tight text-(--text-1)">RootLens</span>
          </div>

          <div className="mt-16 max-w-md">
            <h1 className="text-3xl font-bold tracking-tight text-(--text-1) leading-tight">
              Enterprise root-cause intelligence, ready for deployment.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-(--text-2)">
              Upload your datasets, identify core business drivers, and quantify risk instantly without configuring complex ML pipelines.
            </p>
          </div>

          <div className="mt-12 space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--c-info-bg) border border-(--c-info-border)">
                <ShieldCheck className="h-4 w-4 text-(--c-info)" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--text-1)">SOC2 Ready & Audit Friendly</h3>
                <p className="mt-1 text-sm text-(--text-3)">All models include full lineage tracking, fairness metrics, and SHAP-based explainability by default.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--c-success-bg) border border-(--c-success-border)">
                <Server className="h-4 w-4 text-(--c-success)" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--text-1)">End-to-End Encryption</h3>
                <p className="mt-1 text-sm text-(--text-3)">Data is encrypted in transit and at rest. Strict role-based access controls for enterprise teams.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-(--brand-dim) border border-(--border-brand)">
                <Lock className="h-4 w-4 text-(--brand)" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--text-1)">Private Cloud Deployable</h3>
                <p className="mt-1 text-sm text-(--text-3)">Run RootLens in your own VPC. No data leaves your secure perimeter.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-(--text-3)">
          <span>© {new Date().getFullYear()} RootLens Inc.</span>
          <span className="h-1 w-1 rounded-full bg-(--text-4)" />
          <a href="#" className="hover:text-(--text-1) transition-colors">Privacy</a>
          <span className="h-1 w-1 rounded-full bg-(--text-4)" />
          <a href="#" className="hover:text-(--text-1) transition-colors">Terms</a>
        </div>
      </div>

      {/* ── Right Panel: Auth Form ── */}
      <div className="flex w-full flex-col justify-center px-6 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24 bg-(--surface-0)">
        <div className="mb-8 lg:hidden flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-(--brand-dim) border border-(--border-brand)">
            <Activity className="h-4 w-4 text-(--brand)" />
          </div>
          <span className="text-lg font-bold text-(--text-1)">RootLens</span>
        </div>

        <div className="w-full max-w-sm mx-auto lg:mx-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-(--text-1)">Sign in to workspace</h2>
            <p className="mt-1.5 text-sm text-(--text-3)">Enter your credentials to continue</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Input
                label="Work email address"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
              />
            </div>

            <div>
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="flex items-center text-(--text-3) hover:text-(--text-1) transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            {err && (
              <div className="flex items-center gap-2 rounded-md border border-(--c-danger-border) bg-(--c-danger-bg) px-3 py-2.5 text-sm font-medium text-(--c-danger)">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {err}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                loading={busy}
                className="w-full h-10 text-sm font-semibold"
              >
                Sign in to workspace
              </Button>
            </div>
          </form>

          <p className="mt-6 text-sm text-(--text-3)">
            No workspace yet?{' '}
            <Link className="font-semibold text-(--brand) transition-colors hover:text-(--text-1)" to="/register">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
